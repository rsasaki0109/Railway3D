from __future__ import annotations

from pathlib import Path
from typing import Any

from railway3d_pipeline.json_utils import read_json, sha256_prefixed_json, write_json
from railway3d_pipeline.source_adapters import adapter_summary
from railway3d_pipeline.source_audit import format_boolish
from railway3d_pipeline.synthetic import PipelineError


PILOT_CORRIDOR_PATH = Path("data/regions/jp/tokyo-metro-pilot-corridor.json")

REQUIRED_TOP_LEVEL_FIELDS = (
    "regionId",
    "kind",
    "title",
    "selectedAt",
    "selectionStatus",
    "scope",
    "corridor",
    "selectionCriteria",
    "criteriaResults",
    "fixedSnapshots",
    "publicPackageDecision",
    "unresolvedGates",
)

REQUIRED_CORRIDOR_FIELDS = (
    "id",
    "name",
    "operatorName",
    "lineName",
    "fromStation",
    "toStation",
    "approxBounds",
    "rationale",
)

REQUIRED_SNAPSHOT_ADAPTERS = ("n02", "osm-pbf", "gsi-dem", "manual-control-points")


def load_pilot_corridor_selection(path: Path = PILOT_CORRIDOR_PATH) -> dict[str, Any]:
    document = read_json(path)
    return parse_pilot_corridor_selection(document)


def parse_pilot_corridor_selection(document: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(document, dict) or document.get("kind") != "pilot-corridor-selection":
        raise PipelineError(
            "CORRIDOR_DOC_INVALID",
            "Pilot corridor document root must be an object with kind 'pilot-corridor-selection'.",
        )

    missing_fields = [field for field in REQUIRED_TOP_LEVEL_FIELDS if field not in document]
    if missing_fields:
        raise PipelineError(
            "CORRIDOR_DOC_INVALID",
            "; ".join(f"missing required field {field!r}" for field in missing_fields),
        )

    if document["regionId"] != "jp-tokyo-metro":
        raise PipelineError(
            "CORRIDOR_REGION_UNSUPPORTED",
            f"Only regionId 'jp-tokyo-metro' is supported in PR-015; got {document['regionId']!r}.",
        )

    if document["selectionStatus"] not in {"geometry-inventory-pilot", "blocked"}:
        raise PipelineError(
            "CORRIDOR_STATUS_INVALID",
            f"selectionStatus {document['selectionStatus']!r} is not recognized.",
        )

    corridor = document["corridor"]
    if not isinstance(corridor, dict):
        raise PipelineError("CORRIDOR_DOC_INVALID", "corridor must be an object.")

    missing_corridor = [field for field in REQUIRED_CORRIDOR_FIELDS if field not in corridor]
    if missing_corridor:
        raise PipelineError(
            "CORRIDOR_DOC_INVALID",
            "; ".join(f"corridor missing required field {field!r}" for field in missing_corridor),
        )

    bounds = corridor["approxBounds"]
    if not is_ordered_bbox(bounds):
        raise PipelineError(
            "CORRIDOR_BOUNDS_INVALID",
            "corridor.approxBounds must be [minLng, minLat, maxLng, maxLat] with ordered values.",
        )

    criteria = document["selectionCriteria"]
    results = document["criteriaResults"]
    if not isinstance(criteria, list) or not criteria:
        raise PipelineError("CORRIDOR_CRITERIA_INVALID", "selectionCriteria must be a non-empty list.")
    if not isinstance(results, dict):
        raise PipelineError("CORRIDOR_CRITERIA_INVALID", "criteriaResults must be an object.")

    criteria_messages = validate_criteria(criteria, results)
    if criteria_messages:
        raise PipelineError("CORRIDOR_CRITERIA_FAILED", "; ".join(criteria_messages))

    snapshots = document["fixedSnapshots"]
    if not isinstance(snapshots, dict):
        raise PipelineError("CORRIDOR_SNAPSHOTS_INVALID", "fixedSnapshots must be an object.")

    snapshot_messages = validate_snapshots(snapshots)
    if snapshot_messages:
        raise PipelineError("CORRIDOR_SNAPSHOTS_INVALID", "; ".join(snapshot_messages))

    if not str(document["publicPackageDecision"]).startswith("blocked"):
        raise PipelineError(
            "CORRIDOR_PACKAGE_NOT_BLOCKED",
            "publicPackageDecision must remain blocked while rail elevation controls are unapproved.",
        )

    normalized_snapshots = {
        adapter_id: {
            **snapshot,
            "adapterSpec": adapter_summary(snapshot["adapter"]),
        }
        for adapter_id, snapshot in snapshots.items()
    }

    report = {
        "regionId": document["regionId"],
        "kind": document["kind"],
        "title": document["title"],
        "selectedAt": document["selectedAt"],
        "selectionStatus": document["selectionStatus"],
        "scope": document["scope"],
        "corridor": corridor,
        "selectionCriteria": criteria,
        "criteriaResults": results,
        "fixedSnapshots": normalized_snapshots,
        "publicPackageDecision": document["publicPackageDecision"],
        "unresolvedGates": document["unresolvedGates"],
        "adapterStatuses": {
            adapter_id: snapshot["adapterSpec"]["status"]
            for adapter_id, snapshot in normalized_snapshots.items()
        },
        "checksum": sha256_prefixed_json(
            {
                "regionId": document["regionId"],
                "corridorId": corridor["id"],
                "selectionStatus": document["selectionStatus"],
                "publicPackageDecision": document["publicPackageDecision"],
                "fixedSnapshots": {
                    key: {
                        "adapter": value["adapter"],
                        "status": value["status"],
                    }
                    for key, value in snapshots.items()
                },
            }
        ),
    }
    return report


def validate_criteria(criteria: list[Any], results: dict[str, Any]) -> list[str]:
    messages: list[str] = []
    for index, criterion in enumerate(criteria):
        if not isinstance(criterion, dict):
            messages.append(f"selectionCriteria/{index}: criterion must be an object")
            continue
        criterion_id = criterion.get("id")
        if not isinstance(criterion_id, str) or not criterion_id:
            messages.append(f"selectionCriteria/{index}: missing id")
            continue
        if criterion.get("required") is not True:
            # Required criteria are the only ones enforced in this milestone.
            continue
        result = results.get(criterion_id)
        if not isinstance(result, dict):
            messages.append(f"criteriaResults missing required criterion {criterion_id!r}")
            continue
        if result.get("status") != "pass":
            messages.append(f"required criterion {criterion_id!r} status is not 'pass'")
        if not result.get("evidence"):
            messages.append(f"required criterion {criterion_id!r} is missing evidence")
    return messages


def validate_snapshots(snapshots: dict[str, Any]) -> list[str]:
    messages: list[str] = []
    for adapter_id in REQUIRED_SNAPSHOT_ADAPTERS:
        if adapter_id not in snapshots:
            messages.append(f"fixedSnapshots missing {adapter_id!r}")
            continue
        snapshot = snapshots[adapter_id]
        if not isinstance(snapshot, dict):
            messages.append(f"fixedSnapshots/{adapter_id}: must be an object")
            continue
        if snapshot.get("adapter") != adapter_id:
            messages.append(f"fixedSnapshots/{adapter_id}: adapter must equal {adapter_id!r}")
        if not snapshot.get("status"):
            messages.append(f"fixedSnapshots/{adapter_id}: missing status")
        if not snapshot.get("role"):
            messages.append(f"fixedSnapshots/{adapter_id}: missing role")

    # Real elevation packaging remains blocked while control points are unapproved.
    control = snapshots.get("manual-control-points")
    if isinstance(control, dict) and not str(control.get("status", "")).startswith("blocked"):
        messages.append(
            "fixedSnapshots/manual-control-points status must remain blocked until public controls are approved"
        )

    for adapter_id in ("n02", "osm-pbf", "gsi-dem"):
        snapshot = snapshots.get(adapter_id)
        if isinstance(snapshot, dict) and snapshot.get("status") == "fetched":
            messages.append(
                f"fixedSnapshots/{adapter_id}: real fetch is not enabled in PR-015; "
                "status must not be 'fetched'"
            )
    return messages


def is_ordered_bbox(value: Any) -> bool:
    if not isinstance(value, list) or len(value) != 4:
        return False
    min_lng, min_lat, max_lng, max_lat = value
    if not all(isinstance(item, (int, float)) and not isinstance(item, bool) for item in value):
        return False
    return min_lng < max_lng and min_lat < max_lat


def write_corridor_plan(region_id: str, output_dir: Path) -> dict[str, Any]:
    if region_id != "jp-tokyo-metro":
        raise PipelineError(
            "CORRIDOR_REGION_UNSUPPORTED",
            f"Only 'jp-tokyo-metro' corridor planning is supported; got {region_id!r}.",
        )

    report = load_pilot_corridor_selection()
    output_dir.mkdir(parents=True, exist_ok=True)
    write_json(output_dir / "pilot-corridor-plan.json", report)
    markdown_path = output_dir / "pilot-corridor-plan.md"
    markdown_path.write_text(corridor_plan_to_markdown(report), encoding="utf-8")
    return {
        "regionId": region_id,
        "corridorId": report["corridor"]["id"],
        "selectionStatus": report["selectionStatus"],
        "publicPackageDecision": report["publicPackageDecision"],
        "checksum": report["checksum"],
        "outputs": [
            str(output_dir / "pilot-corridor-plan.json"),
            str(markdown_path),
        ],
    }


def corridor_plan_to_markdown(report: dict[str, Any]) -> str:
    corridor = report["corridor"]
    name = corridor["name"].get("en") or next(iter(corridor["name"].values()))
    lines = [
        "# Tokyo Metro Pilot Corridor Plan",
        "",
        f"- Region: `{report['regionId']}`",
        f"- Selected at: `{report['selectedAt']}`",
        f"- Selection status: `{report['selectionStatus']}`",
        f"- Corridor ID: `{corridor['id']}`",
        f"- Corridor: {name}",
        f"- Operator: {corridor['operatorName']}",
        f"- Line: {corridor['lineName']}",
        f"- From: {corridor['fromStation']}",
        f"- To: {corridor['toStation']}",
        f"- Bounds: `{corridor['approxBounds']}`",
        f"- Public package decision: {report['publicPackageDecision']}",
        f"- Checksum: `{report['checksum']}`",
        "",
        "## Scope",
        "",
        report["scope"],
        "",
        "## Criteria",
        "",
    ]
    for criterion in report["selectionCriteria"]:
        result = report["criteriaResults"][criterion["id"]]
        lines.append(
            f"- `{criterion['id']}` ({result['status']}): {criterion['description']} "
            f"— {result['evidence']}"
        )

    lines.extend(["", "## Fixed snapshots", ""])
    for adapter_id, snapshot in report["fixedSnapshots"].items():
        lines.extend(
            [
                f"### {adapter_id}",
                "",
                f"- Status: `{snapshot['status']}`",
                f"- Adapter status: `{snapshot['adapterSpec']['status']}`",
                f"- Role: {snapshot['role']}",
                f"- Prohibited use: {snapshot['adapterSpec']['prohibitedUse']}",
            ]
        )
        if snapshot.get("localSyntheticFixture"):
            lines.append(f"- Local synthetic fixture: `{snapshot['localSyntheticFixture']}`")
        lines.append("")

    lines.extend(["## Unresolved gates", ""])
    lines.extend(f"- {item}" for item in report["unresolvedGates"])
    lines.append("")
    return "\n".join(lines)
