from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from referencing import Registry, Resource


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    path: str
    message: str


def validate_dataset_file(dataset_path: Path, schema_dir: Path) -> list[ValidationIssue]:
    schemas = load_schemas(schema_dir)
    dataset = read_json(dataset_path)
    return validate_dataset(dataset, schemas)


def load_schemas(schema_dir: Path) -> list[dict[str, Any]]:
    return [read_json(path) for path in sorted(schema_dir.glob("*.schema.json"))]


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def validate_dataset(dataset: Any, schemas: list[dict[str, Any]]) -> list[ValidationIssue]:
    schema_by_id = {schema["$id"]: schema for schema in schemas}
    dataset_schema = schema_by_id["https://railway3d.dev/schemas/v1/dataset.schema.json"]
    registry = Registry().with_resources(
        (schema_id, Resource.from_contents(schema)) for schema_id, schema in schema_by_id.items()
    )
    validator = Draft202012Validator(dataset_schema, registry=registry)
    schema_issues = [
        ValidationIssue("SCHEMA_INVALID", json_pointer(error.path), error.message)
        for error in sorted(validator.iter_errors(dataset), key=lambda item: item.json_path)
    ]
    if schema_issues:
        return schema_issues

    return validate_dataset_semantics(dataset)


def validate_dataset_semantics(dataset: dict[str, Any]) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    operator_ids = collect_ids(dataset["operators"], "/operators", issues)
    line_ids = collect_ids(dataset["lines"], "/lines", issues)
    route_ids = collect_ids(dataset["routes"], "/routes", issues)
    alignment_ids = collect_ids(dataset["alignments"], "/alignments", issues)
    segment_ids = collect_ids(dataset["segments"], "/segments", issues)
    station_ids = collect_ids(dataset["stations"], "/stations", issues)
    profile_ids = collect_ids(dataset["profiles"], "/profiles", issues)
    collect_ids(dataset["sources"], "/sources", issues)
    collect_ids(dataset["controlPoints"], "/controlPoints", issues)

    segment_by_id = {segment["id"]: segment for segment in dataset["segments"]}
    profile_by_owner = {profile["ownerId"]: profile for profile in dataset["profiles"]}

    for index, line in enumerate(dataset["lines"]):
        expect_refs(line["operatorIds"], operator_ids, f"/lines/{index}/operatorIds", issues)
        expect_refs(line["routeIds"], route_ids, f"/lines/{index}/routeIds", issues)

    for route_index, route in enumerate(dataset["routes"]):
        expect_ref(route["lineId"], line_ids, f"/routes/{route_index}/lineId", issues)
        for ref_index, segment_ref in enumerate(route["segmentRefs"]):
            expect_ref(
                segment_ref["segmentId"],
                segment_ids,
                f"/routes/{route_index}/segmentRefs/{ref_index}/segmentId",
                issues,
            )
        for station_index, station_ref in enumerate(route["stationSequence"]):
            expect_ref(
                station_ref["stationId"],
                station_ids,
                f"/routes/{route_index}/stationSequence/{station_index}/stationId",
                issues,
            )
        validate_route_continuity(route, route_index, segment_by_id, issues)

    for index, alignment in enumerate(dataset["alignments"]):
        expect_refs(alignment["segmentIds"], segment_ids, f"/alignments/{index}/segmentIds", issues)

    for index, segment in enumerate(dataset["segments"]):
        expect_ref(segment["alignmentId"], alignment_ids, f"/segments/{index}/alignmentId", issues)
        expect_ref(segment["profileId"], profile_ids, f"/segments/{index}/profileId", issues)

    for index, station in enumerate(dataset["stations"]):
        expect_refs(station["operatorIds"], operator_ids, f"/stations/{index}/operatorIds", issues)
        expect_refs(station["lineIds"], line_ids, f"/stations/{index}/lineIds", issues)

    for index, profile in enumerate(dataset["profiles"]):
        owner_ids = {
            "route": route_ids,
            "segment": segment_ids,
            "alignment": alignment_ids,
        }[profile["ownerType"]]
        expect_ref(profile["ownerId"], owner_ids, f"/profiles/{index}/ownerId", issues)
        validate_monotonic_samples(profile, index, issues)

    for index, control_point in enumerate(dataset["controlPoints"]):
        if not control_point["hardConstraint"] or "railElevation" not in control_point:
            continue
        profile = profile_by_owner.get(control_point["ownerId"])
        if profile is None:
            expect_ref(
                control_point["ownerId"],
                route_ids,
                f"/controlPoints/{index}/ownerId",
                issues,
            )
            continue
        sample = next(
            (
                candidate
                for candidate in profile["samples"]
                if abs(candidate["chainageM"] - control_point["chainageM"]) < 1e-6
            ),
            None,
        )
        if (
            sample is None
            or sample["railElevationM"] is None
            or abs(sample["railElevationM"] - control_point["railElevation"]["valueM"]) > 1e-6
        ):
            issues.append(
                ValidationIssue(
                    "HARD_CONTROL_MISMATCH",
                    f"/controlPoints/{index}",
                    f"Hard control point {control_point['id']} does not match its profile sample.",
                )
            )

    return issues


def collect_ids(
    items: list[dict[str, Any]], path: str, issues: list[ValidationIssue]
) -> set[str]:
    ids: set[str] = set()
    for index, item in enumerate(items):
        item_id = item["id"]
        if item_id in ids:
            issues.append(ValidationIssue("DUPLICATE_ID", f"{path}/{index}/id", f"Duplicate id: {item_id}"))
        ids.add(item_id)
    return ids


def expect_refs(
    refs: list[str], allowed_ids: set[str], path: str, issues: list[ValidationIssue]
) -> None:
    for index, ref in enumerate(refs):
        expect_ref(ref, allowed_ids, f"{path}/{index}", issues)


def expect_ref(ref: str, allowed_ids: set[str], path: str, issues: list[ValidationIssue]) -> None:
    if ref not in allowed_ids:
        issues.append(ValidationIssue("DANGLING_REFERENCE", path, f"Dangling reference: {ref}"))


def validate_monotonic_samples(
    profile: dict[str, Any], profile_index: int, issues: list[ValidationIssue]
) -> None:
    samples = profile["samples"]
    for index in range(1, len(samples)):
        if samples[index]["chainageM"] <= samples[index - 1]["chainageM"]:
            issues.append(
                ValidationIssue(
                    "CHAINAGE_NOT_MONOTONIC",
                    f"/profiles/{profile_index}/samples/{index}/chainageM",
                    f"Profile {profile['id']} chainage must be strictly increasing.",
                )
            )


def validate_route_continuity(
    route: dict[str, Any],
    route_index: int,
    segment_by_id: dict[str, dict[str, Any]],
    issues: list[ValidationIssue],
) -> None:
    segment_refs = route["segmentRefs"]
    for index in range(1, len(segment_refs)):
        previous_ref = segment_refs[index - 1]
        current_ref = segment_refs[index]
        previous_segment = segment_by_id.get(previous_ref["segmentId"])
        current_segment = segment_by_id.get(current_ref["segmentId"])
        if previous_segment is None or current_segment is None:
            continue
        previous_end = (
            previous_segment["to"]["position"] if previous_ref["forward"] else previous_segment["from"]["position"]
        )
        current_start = (
            current_segment["from"]["position"] if current_ref["forward"] else current_segment["to"]["position"]
        )
        if not same_lng_lat(previous_end, current_start):
            issues.append(
                ValidationIssue(
                    "ROUTE_SEGMENT_DISCONNECTED",
                    f"/routes/{route_index}/segmentRefs/{index}",
                    f"Route {route['id']} has disconnected consecutive segments.",
                )
            )


def same_lng_lat(left: list[float], right: list[float]) -> bool:
    return abs(left[0] - right[0]) < 1e-9 and abs(left[1] - right[1]) < 1e-9


def json_pointer(parts: Any) -> str:
    values = [str(part).replace("~", "~0").replace("/", "~1") for part in parts]
    return "/" + "/".join(values) if values else "/"
