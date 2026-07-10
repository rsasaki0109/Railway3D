from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from railway3d_pipeline.json_utils import read_json, sha256_prefixed_json
from railway3d_pipeline.source_adapters import adapter_summary
from railway3d_pipeline.source_audit import format_boolish
from railway3d_pipeline.synthetic import PipelineError


DOCUMENT_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._:-]*$")

KNOWN_VERTICAL_DATUMS = {
    "JGD2024_ORTHOMETRIC",
    "JGD2011_ORTHOMETRIC",
    "WGS84_ELLIPSOIDAL",
    "EGM2008_ORTHOMETRIC",
    "LOCAL_ENGINEERING_DATUM",
}
VERTICAL_DATUMS = KNOWN_VERTICAL_DATUMS | {"UNKNOWN"}

ELEVATION_KINDS = {
    "rail_elevation",
    "platform_elevation",
    "portal",
    "grade_break",
    "structure_boundary",
}
ALLOWED_POINT_KINDS = ELEVATION_KINDS | {"relative_depth"}
ALLOWED_TARGETS = {
    "top_of_rail",
    "platform_level",
    "tunnel_portal",
    "structure_boundary",
    "grade_break",
}

REQUIRED_TOP_LEVEL_FIELDS = (
    "documentId",
    "title",
    "synthetic",
    "authoredBy",
    "authoredAt",
    "verticalDatum",
    "license",
    "points",
)
REQUIRED_POINT_FIELDS = (
    "id",
    "ownerId",
    "chainageM",
    "kind",
    "hardConstraint",
    "definition",
    "target",
    "method",
    "confidence",
)


def load_control_point_document(path: Path) -> dict[str, Any]:
    document = read_json(path)
    return ingest_control_point_document(document)


def ingest_control_point_document(document: dict[str, Any], *, config_path: Path | None = None) -> dict[str, Any]:
    del config_path  # Reserved for future adapter-config wiring; unused for manual documents.

    if not isinstance(document, dict) or document.get("kind") != "manual-control-points":
        raise PipelineError(
            "MANUAL_CONTROL_DOC_INVALID",
            "Manual control point document root must be an object with kind 'manual-control-points'.",
        )

    missing_fields = [field for field in REQUIRED_TOP_LEVEL_FIELDS if field not in document]
    if missing_fields:
        raise PipelineError(
            "MANUAL_CONTROL_DOC_INVALID",
            "; ".join(f"missing required field {field!r}" for field in missing_fields),
        )

    document_id = document["documentId"]
    if not isinstance(document_id, str) or not DOCUMENT_ID_PATTERN.match(document_id):
        raise PipelineError(
            "MANUAL_CONTROL_DOC_INVALID",
            f"documentId {document_id!r} must match ^[a-z0-9][a-z0-9._:-]*$.",
        )

    vertical_datum = document["verticalDatum"]
    if vertical_datum not in VERTICAL_DATUMS:
        raise PipelineError(
            "MANUAL_CONTROL_DOC_INVALID",
            f"verticalDatum {vertical_datum!r} is not a recognized vertical datum.",
        )

    points = document["points"]
    if not isinstance(points, list):
        raise PipelineError("MANUAL_CONTROL_DOC_INVALID", "points must be a list.")

    license_info = document["license"]
    if (
        not isinstance(license_info, dict)
        or not isinstance(license_info.get("id"), str)
        or not isinstance(license_info.get("redistributionAllowed"), bool)
    ):
        raise PipelineError(
            "MANUAL_CONTROL_LICENSE_INVALID",
            "license must include a string id and a boolean redistributionAllowed.",
        )

    incomplete_messages = collect_point_incompleteness(points)
    if incomplete_messages:
        raise PipelineError("MANUAL_CONTROL_POINT_INCOMPLETE", "; ".join(incomplete_messages))

    has_elevation_point = any(point["kind"] in ELEVATION_KINDS for point in points)
    if has_elevation_point and vertical_datum == "UNKNOWN":
        raise PipelineError(
            "MANUAL_CONTROL_DATUM_UNKNOWN",
            "Document vertical datum is UNKNOWN; an unknown datum cannot carry rail/structure elevation values.",
        )

    duplicate_messages = collect_duplicate_ids(points)
    if duplicate_messages:
        raise PipelineError("MANUAL_CONTROL_DUPLICATE_ID", "; ".join(duplicate_messages))

    chainage_messages = collect_chainage_violations(points)
    if chainage_messages:
        raise PipelineError("MANUAL_CONTROL_CHAINAGE_NOT_MONOTONIC", "; ".join(chainage_messages))

    control_points = [normalize_control_point(point, document_id, vertical_datum) for point in points]
    checksum = sha256_prefixed_json(control_points)
    redistribution_allowed = license_info["redistributionAllowed"]

    return {
        "documentId": document_id,
        "title": document["title"],
        "kind": "manual-control-points",
        "synthetic": bool(document["synthetic"]),
        "authoredBy": document["authoredBy"],
        "authoredAt": document["authoredAt"],
        "verticalDatum": vertical_datum,
        "licenseId": license_info["id"],
        "redistributionAllowed": redistribution_allowed,
        "adapterSpec": adapter_summary("manual-control-points"),
        "controlPointCount": len(control_points),
        "publicRedistributionDecision": (
            "allowed"
            if redistribution_allowed
            else "blocked: manual control point license does not permit public redistribution"
        ),
        "controlPoints": control_points,
        "controlPointSummaries": [summarize_point(point) for point in points],
        "checksum": checksum,
    }


def collect_point_incompleteness(points: list[Any]) -> list[str]:
    messages: list[str] = []
    for index, point in enumerate(points):
        if not isinstance(point, dict):
            messages.append(f"points/{index}: point must be an object")
            continue

        for field in REQUIRED_POINT_FIELDS:
            if field not in point:
                messages.append(f"points/{index}: missing field {field!r}")

        kind = point.get("kind")
        if "kind" in point and kind not in ALLOWED_POINT_KINDS:
            messages.append(f"points/{index}: invalid kind {kind!r}")
        if "target" in point and point["target"] not in ALLOWED_TARGETS:
            messages.append(f"points/{index}: invalid target {point['target']!r}")
        if "chainageM" in point and not is_non_negative_number(point["chainageM"]):
            messages.append(f"points/{index}: chainageM must be a number >= 0")

        if kind in ELEVATION_KINDS:
            if not is_number(point.get("valueM")):
                messages.append(f"points/{index}: elevation-bearing kind {kind!r} requires numeric valueM")
            if not point.get("sourceCitation"):
                messages.append(f"points/{index}: elevation-bearing kind {kind!r} requires sourceCitation")
        elif kind == "relative_depth":
            if not is_number(point.get("relativeDepthM")):
                messages.append(f"points/{index}: relative_depth kind requires numeric relativeDepthM")
            if not point.get("sourceCitation"):
                messages.append(f"points/{index}: relative_depth kind requires sourceCitation")
    return messages


def collect_duplicate_ids(points: list[dict[str, Any]]) -> list[str]:
    seen: set[Any] = set()
    messages: list[str] = []
    for index, point in enumerate(points):
        point_id = point.get("id")
        if point_id in seen:
            messages.append(f"points/{index}: duplicate id {point_id!r}")
        else:
            seen.add(point_id)
    return messages


def collect_chainage_violations(points: list[dict[str, Any]]) -> list[str]:
    last_chainage_by_owner: dict[Any, Any] = {}
    messages: list[str] = []
    for index, point in enumerate(points):
        owner_id = point.get("ownerId")
        chainage = point.get("chainageM")
        if owner_id is None or not is_number(chainage):
            continue
        previous = last_chainage_by_owner.get(owner_id)
        if previous is not None and chainage <= previous:
            messages.append(
                f"owner {owner_id!r} points/{index}: chainageM must be strictly increasing "
                f"(previous {previous}, got {chainage})"
            )
        last_chainage_by_owner[owner_id] = chainage
    return messages


def normalize_control_point(point: dict[str, Any], document_id: str, vertical_datum: str) -> dict[str, Any]:
    normalized: dict[str, Any] = {
        "id": point["id"],
        "ownerId": point["ownerId"],
        "chainageM": point["chainageM"],
        "kind": point["kind"],
        "hardConstraint": point["hardConstraint"],
    }
    if point["kind"] in ELEVATION_KINDS:
        elevation_value: dict[str, Any] = {
            "valueM": point["valueM"],
            "verticalDatum": vertical_datum,
            "method": point["method"],
            "confidence": point["confidence"],
            "provenance": [
                {
                    "sourceId": document_id,
                    "method": point["method"],
                    "operatorNote": point["sourceCitation"],
                }
            ],
            "flags": [],
        }
        if "uncertaintyM" in point:
            elevation_value["uncertaintyM"] = point["uncertaintyM"]
        normalized["railElevation"] = elevation_value
    elif point["kind"] == "relative_depth":
        normalized["relativeDepthM"] = point["relativeDepthM"]
    if point.get("note"):
        normalized["note"] = point["note"]
    return normalized


def summarize_point(point: dict[str, Any]) -> dict[str, Any]:
    summary = {
        "id": point.get("id"),
        "chainageM": point.get("chainageM"),
        "kind": point.get("kind"),
        "target": point.get("target"),
    }
    if point.get("kind") in ELEVATION_KINDS:
        summary["valueM"] = point.get("valueM")
    elif point.get("kind") == "relative_depth":
        summary["relativeDepthM"] = point.get("relativeDepthM")
    return summary


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def is_non_negative_number(value: Any) -> bool:
    return is_number(value) and value >= 0


def control_point_report_to_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Manual Control Point Ingestion",
        "",
        f"- Document ID: `{report['documentId']}`",
        f"- Title: {report['title']}",
        f"- Synthetic: {format_boolish(report['synthetic'])}",
        f"- Authored by: {report['authoredBy']}",
        f"- Authored at: {report['authoredAt']}",
        f"- Vertical datum: {report['verticalDatum']}",
        f"- License: {report['licenseId']}",
        f"- Redistribution allowed: {format_boolish(report['redistributionAllowed'])}",
        f"- Public redistribution decision: {report['publicRedistributionDecision']}",
        f"- Checksum: `{report['checksum']}`",
        "",
        "## Control Points",
        "",
        "| id | chainageM | kind | target | value |",
        "| --- | --- | --- | --- | --- |",
    ]
    for summary in report["controlPointSummaries"]:
        value = summary.get("valueM", summary.get("relativeDepthM"))
        lines.append(
            f"| {summary['id']} | {summary['chainageM']} | {summary['kind']} | {summary['target']} | {value} |"
        )
    return "\n".join(lines) + "\n"
