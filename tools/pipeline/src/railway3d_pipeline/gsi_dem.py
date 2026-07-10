from __future__ import annotations

from pathlib import Path
from typing import Any

from railway3d_pipeline.control_points import DOCUMENT_ID_PATTERN, KNOWN_VERTICAL_DATUMS, is_number
from railway3d_pipeline.json_utils import read_json, sha256_prefixed_json
from railway3d_pipeline.source_adapters import adapter_summary
from railway3d_pipeline.source_audit import format_boolish
from railway3d_pipeline.synthetic import PipelineError


REQUIRED_TOP_LEVEL_FIELDS = (
    "documentId",
    "title",
    "synthetic",
    "authoredBy",
    "authoredAt",
    "verticalDatum",
    "role",
    "bbox",
    "grid",
    "license",
    "values",
)

ALLOWED_ROLES = {"ground_elevation", "terrain_rendering"}


def load_gsi_dem_grid(path: Path) -> dict[str, Any]:
    document = read_json(path)
    return parse_gsi_dem_grid(document)


def parse_gsi_dem_grid(document: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(document, dict) or document.get("kind") != "gsi-dem-grid":
        raise PipelineError(
            "GSI_DEM_DOC_INVALID",
            "GSI DEM grid document root must be an object with kind 'gsi-dem-grid'.",
        )

    missing_fields = [field for field in REQUIRED_TOP_LEVEL_FIELDS if field not in document]
    if missing_fields:
        raise PipelineError(
            "GSI_DEM_DOC_INVALID",
            "; ".join(f"missing required field {field!r}" for field in missing_fields),
        )

    document_id = document["documentId"]
    if not isinstance(document_id, str) or not DOCUMENT_ID_PATTERN.match(document_id):
        raise PipelineError(
            "GSI_DEM_DOC_INVALID",
            f"documentId {document_id!r} must match ^[a-z0-9][a-z0-9._:-]*$.",
        )

    role = document["role"]
    if role not in ALLOWED_ROLES:
        raise PipelineError(
            "GSI_DEM_ROLE_INVALID",
            f"role {role!r} is not allowed; GSI DEM may only be used for {sorted(ALLOWED_ROLES)}.",
        )

    vertical_datum = document["verticalDatum"]
    if vertical_datum not in KNOWN_VERTICAL_DATUMS:
        raise PipelineError(
            "GSI_DEM_DATUM_UNKNOWN",
            "GSI DEM ground samples require an explicit known vertical datum; "
            f"got {vertical_datum!r}. UNKNOWN is rejected for elevation packaging.",
        )

    license_info = document["license"]
    if (
        not isinstance(license_info, dict)
        or not isinstance(license_info.get("id"), str)
        or not isinstance(license_info.get("redistributionAllowed"), bool)
    ):
        raise PipelineError(
            "GSI_DEM_LICENSE_INVALID",
            "license must include a string id and a boolean redistributionAllowed.",
        )

    bbox = document["bbox"]
    if not is_bbox(bbox):
        raise PipelineError(
            "GSI_DEM_BBOX_INVALID",
            "bbox must be [minLng, minLat, maxLng, maxLat] with ordered, in-range coordinates.",
        )

    grid = document["grid"]
    grid_messages = collect_grid_invalidity(grid)
    if grid_messages:
        raise PipelineError("GSI_DEM_GRID_INVALID", "; ".join(grid_messages))

    values = document["values"]
    void_value = document.get("voidValue", -9999)
    value_messages = collect_values_invalidity(values, grid, void_value)
    if value_messages:
        raise PipelineError("GSI_DEM_VALUES_INVALID", "; ".join(value_messages))

    samples = build_ground_samples(document_id, grid, values, void_value, vertical_datum)
    sample_payload = {
        "documentId": document_id,
        "verticalDatum": vertical_datum,
        "role": role,
        "samples": samples,
    }
    checksum = sha256_prefixed_json(sample_payload)
    redistribution_allowed = license_info["redistributionAllowed"]
    known_count = sum(1 for sample in samples if sample["isVoid"] is False)
    void_count = sum(1 for sample in samples if sample["isVoid"] is True)

    return {
        "documentId": document_id,
        "title": document["title"],
        "kind": "gsi-dem-grid",
        "synthetic": bool(document["synthetic"]),
        "authoredBy": document["authoredBy"],
        "authoredAt": document["authoredAt"],
        "product": document.get("product", "unspecified"),
        "horizontalCrs": document.get("horizontalCrs", "UNSPECIFIED"),
        "verticalDatum": vertical_datum,
        "role": role,
        "bbox": bbox,
        "licenseId": license_info["id"],
        "redistributionAllowed": redistribution_allowed,
        "adapterSpec": adapter_summary("gsi-dem"),
        "sampleCount": len(samples),
        "knownSampleCount": known_count,
        "voidSampleCount": void_count,
        "publicRedistributionDecision": (
            "allowed"
            if redistribution_allowed
            else "blocked: GSI DEM license does not permit public redistribution"
        ),
        "elevationPolicy": (
            "GSI DEM samples are ground elevation only. This adapter never emits railElevation, "
            "never treats DEM values as top-of-rail controls, and never uses DEM to validate rail elevation."
        ),
        "samples": samples,
        "sampleSummaries": [summarize_sample(sample) for sample in samples[:20]],
        "checksum": checksum,
    }


def collect_grid_invalidity(grid: Any) -> list[str]:
    messages: list[str] = []
    if not isinstance(grid, dict):
        return ["grid must be an object"]

    for field in ("columns", "rows", "cellSizeDeg", "origin"):
        if field not in grid:
            messages.append(f"grid missing {field!r}")

    if messages:
        return messages

    if not isinstance(grid["columns"], int) or grid["columns"] < 1:
        messages.append("grid.columns must be a positive integer")
    if not isinstance(grid["rows"], int) or grid["rows"] < 1:
        messages.append("grid.rows must be a positive integer")
    if not is_number(grid["cellSizeDeg"]) or grid["cellSizeDeg"] <= 0:
        messages.append("grid.cellSizeDeg must be a positive number")

    origin = grid["origin"]
    if not isinstance(origin, dict):
        messages.append("grid.origin must be an object")
    else:
        if not is_number(origin.get("lng")) or not (-180 <= origin["lng"] <= 180):
            messages.append("grid.origin.lng must be a valid longitude")
        if not is_number(origin.get("lat")) or not (-90 <= origin["lat"] <= 90):
            messages.append("grid.origin.lat must be a valid latitude")
        if origin.get("corner") not in {"southwest"}:
            messages.append("grid.origin.corner must be 'southwest' in this adapter")
    return messages


def collect_values_invalidity(values: Any, grid: dict[str, Any], void_value: Any) -> list[str]:
    messages: list[str] = []
    if not isinstance(values, list):
        return ["values must be a list of rows"]

    rows = grid["rows"]
    columns = grid["columns"]
    if len(values) != rows:
        messages.append(f"values has {len(values)} rows but grid.rows is {rows}")
        return messages

    for row_index, row in enumerate(values):
        if not isinstance(row, list):
            messages.append(f"values/{row_index}: row must be a list")
            continue
        if len(row) != columns:
            messages.append(f"values/{row_index}: expected {columns} columns, got {len(row)}")
            continue
        for col_index, value in enumerate(row):
            if value == void_value:
                continue
            if not is_number(value):
                messages.append(f"values/{row_index}/{col_index}: value must be numeric or void")
    return messages


def build_ground_samples(
    document_id: str,
    grid: dict[str, Any],
    values: list[list[Any]],
    void_value: Any,
    vertical_datum: str,
) -> list[dict[str, Any]]:
    samples: list[dict[str, Any]] = []
    origin = grid["origin"]
    cell = grid["cellSizeDeg"]
    for row_index, row in enumerate(values):
        for col_index, value in enumerate(row):
            # Row 0 is the southernmost row when origin is southwest.
            lng = origin["lng"] + col_index * cell
            lat = origin["lat"] + row_index * cell
            is_void = value == void_value
            sample_id = f"r3d:jp:gsidem:sample:sm-{row_index:04d}-{col_index:04d}"
            sample: dict[str, Any] = {
                "id": sample_id,
                "row": row_index,
                "column": col_index,
                "position": [lng, lat],
                "isVoid": is_void,
                "role": "ground_elevation",
                "verticalDatum": vertical_datum,
                "method": "dem_sampled",
                "confidence": "low",
                "sourceRefs": [
                    {
                        "sourceId": document_id,
                        "method": "dem_sampled",
                        "sourceFeatureId": f"cell/{row_index}/{col_index}",
                    }
                ],
                "flags": ["DEM_VOID"] if is_void else ["MISSING_RAIL_ELEVATION"],
            }
            if is_void:
                sample["groundElevationM"] = None
            else:
                sample["groundElevationM"] = float(value)
            # Explicitly never populate rail elevation fields.
            sample["railElevationM"] = None
            samples.append(sample)
    return samples


def is_bbox(value: Any) -> bool:
    if not isinstance(value, list) or len(value) != 4:
        return False
    min_lng, min_lat, max_lng, max_lat = value
    if not all(is_number(item) for item in value):
        return False
    if not (-180 <= min_lng <= 180 and -180 <= max_lng <= 180):
        return False
    if not (-90 <= min_lat <= 90 and -90 <= max_lat <= 90):
        return False
    return min_lng < max_lng and min_lat < max_lat


def summarize_sample(sample: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": sample["id"],
        "position": sample["position"],
        "isVoid": sample["isVoid"],
        "groundElevationM": sample["groundElevationM"],
        "railElevationM": sample["railElevationM"],
    }


def gsi_dem_report_to_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# GSI DEM Grid Parse",
        "",
        f"- Document ID: `{report['documentId']}`",
        f"- Title: {report['title']}",
        f"- Synthetic: {format_boolish(report['synthetic'])}",
        f"- Authored by: {report['authoredBy']}",
        f"- Authored at: {report['authoredAt']}",
        f"- Product: {report['product']}",
        f"- Horizontal CRS: {report['horizontalCrs']}",
        f"- Vertical datum: {report['verticalDatum']}",
        f"- Role: {report['role']}",
        f"- BBox: `{report['bbox']}`",
        f"- License: {report['licenseId']}",
        f"- Redistribution allowed: {format_boolish(report['redistributionAllowed'])}",
        f"- Public redistribution decision: {report['publicRedistributionDecision']}",
        f"- Elevation policy: {report['elevationPolicy']}",
        f"- Checksum: `{report['checksum']}`",
        f"- Samples: {report['sampleCount']} (known {report['knownSampleCount']}, void {report['voidSampleCount']})",
        "",
        "## Sample preview (first 20)",
        "",
        "| id | position | void | groundElevationM | railElevationM |",
        "| --- | --- | --- | --- | --- |",
    ]
    for summary in report["sampleSummaries"]:
        ground = "null" if summary["groundElevationM"] is None else f"{summary['groundElevationM']}"
        rail = "null" if summary["railElevationM"] is None else f"{summary['railElevationM']}"
        lines.append(
            f"| {summary['id']} | {summary['position']} | {format_boolish(summary['isVoid'])} | {ground} | {rail} |"
        )

    return "\n".join(lines) + "\n"
