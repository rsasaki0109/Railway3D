from __future__ import annotations

from pathlib import Path
from typing import Any

from railway3d_pipeline.control_points import DOCUMENT_ID_PATTERN, is_number
from railway3d_pipeline.json_utils import read_json, sha256_hex, sha256_prefixed_json
from railway3d_pipeline.source_adapters import adapter_summary
from railway3d_pipeline.source_audit import format_boolish
from railway3d_pipeline.synthetic import PipelineError


FEATURE_CLASSES = {"RailroadSection", "Station"}
GEOMETRY_TYPES = {"LineString", "Point"}

REQUIRED_TOP_LEVEL_FIELDS = (
    "documentId",
    "title",
    "synthetic",
    "authoredBy",
    "authoredAt",
    "license",
    "features",
)


def load_n02_inventory_document(path: Path) -> dict[str, Any]:
    document = read_json(path)
    return parse_n02_inventory_document(document)


def parse_n02_inventory_document(document: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(document, dict) or document.get("kind") != "n02-inventory":
        raise PipelineError(
            "N02_DOC_INVALID",
            "N02 inventory document root must be an object with kind 'n02-inventory'.",
        )

    missing_fields = [field for field in REQUIRED_TOP_LEVEL_FIELDS if field not in document]
    if missing_fields:
        raise PipelineError(
            "N02_DOC_INVALID",
            "; ".join(f"missing required field {field!r}" for field in missing_fields),
        )

    document_id = document["documentId"]
    if not isinstance(document_id, str) or not DOCUMENT_ID_PATTERN.match(document_id):
        raise PipelineError(
            "N02_DOC_INVALID",
            f"documentId {document_id!r} must match ^[a-z0-9][a-z0-9._:-]*$.",
        )

    features = document["features"]
    if not isinstance(features, list):
        raise PipelineError("N02_DOC_INVALID", "features must be a list.")

    license_info = document["license"]
    if (
        not isinstance(license_info, dict)
        or not isinstance(license_info.get("id"), str)
        or not isinstance(license_info.get("redistributionAllowed"), bool)
    ):
        raise PipelineError(
            "N02_LICENSE_INVALID",
            "license must include a string id and a boolean redistributionAllowed.",
        )

    incomplete_messages = collect_feature_incompleteness(features)
    if incomplete_messages:
        raise PipelineError("N02_FEATURE_INCOMPLETE", "; ".join(incomplete_messages))

    geometry_messages = collect_geometry_invalidity(features)
    if geometry_messages:
        raise PipelineError("N02_GEOMETRY_INVALID", "; ".join(geometry_messages))

    operators, lines, stations = build_inventory(features, document_id)
    checksum = sha256_prefixed_json({"operators": operators, "lines": lines, "stations": stations})
    redistribution_allowed = license_info["redistributionAllowed"]

    return {
        "documentId": document_id,
        "title": document["title"],
        "kind": "n02-inventory",
        "synthetic": bool(document["synthetic"]),
        "authoredBy": document["authoredBy"],
        "authoredAt": document["authoredAt"],
        "licenseId": license_info["id"],
        "redistributionAllowed": redistribution_allowed,
        "adapterSpec": adapter_summary("n02"),
        "operatorCount": len(operators),
        "lineCount": len(lines),
        "stationCount": len(stations),
        "publicRedistributionDecision": (
            "allowed"
            if redistribution_allowed
            else "blocked: N02 inventory license does not permit public redistribution"
        ),
        "operators": operators,
        "lines": lines,
        "stations": stations,
        "operatorSummaries": [summarize_operator(operator) for operator in operators],
        "lineSummaries": [summarize_line(line, operators) for line in lines],
        "stationSummaries": [summarize_station(station, lines) for station in stations],
        "checksum": checksum,
    }


def collect_feature_incompleteness(features: list[Any]) -> list[str]:
    messages: list[str] = []
    for index, feature in enumerate(features):
        if not isinstance(feature, dict):
            messages.append(f"features/{index}: feature must be an object")
            continue

        feature_class = feature.get("featureClass")
        if feature_class is None:
            messages.append(f"features/{index}: missing featureClass")
        elif feature_class not in FEATURE_CLASSES:
            messages.append(f"features/{index}: invalid featureClass {feature_class!r}")

        if not feature.get("featureId"):
            messages.append(f"features/{index}: missing featureId")

        properties = feature.get("properties")
        if not isinstance(properties, dict):
            messages.append(f"features/{index}: missing properties")
            properties = {}

        if feature_class == "RailroadSection":
            for field in ("N02_003", "N02_004"):
                if not properties.get(field):
                    messages.append(f"features/{index}: RailroadSection missing property {field!r}")
        elif feature_class == "Station":
            for field in ("N02_003", "N02_004", "N02_005"):
                if not properties.get(field):
                    messages.append(f"features/{index}: Station missing property {field!r}")
    return messages


def collect_geometry_invalidity(features: list[dict[str, Any]]) -> list[str]:
    messages: list[str] = []
    for index, feature in enumerate(features):
        if not isinstance(feature, dict):
            continue  # already reported by collect_feature_incompleteness

        geometry = feature.get("geometry")
        if not isinstance(geometry, dict):
            messages.append(f"features/{index}: missing geometry")
            continue

        geometry_type = geometry.get("type")
        if geometry_type not in GEOMETRY_TYPES:
            messages.append(f"features/{index}: invalid geometry type {geometry_type!r}")
            continue

        coordinates = geometry.get("coordinates")
        if geometry_type == "Point":
            if not is_lng_lat(coordinates):
                messages.append(f"features/{index}: Point coordinates must be a [lng, lat] pair within range")
        else:
            if not isinstance(coordinates, list) or len(coordinates) == 0:
                messages.append(f"features/{index}: LineString coordinates must not be empty")
            elif len(coordinates) < 2:
                messages.append(f"features/{index}: LineString requires at least 2 coordinates")
            else:
                for point_index, point in enumerate(coordinates):
                    if not is_lng_lat(point):
                        messages.append(
                            f"features/{index}: coordinate {point_index} must be a [lng, lat] pair within range"
                        )
    return messages


def build_inventory(
    features: list[dict[str, Any]], document_id: str
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    operators_by_name: dict[str, dict[str, Any]] = {}
    lines_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    stations: list[dict[str, Any]] = []

    for feature in features:
        properties = feature["properties"]
        operator_name = properties["N02_004"]
        line_name = properties["N02_003"]
        feature_id = feature["featureId"]

        if operator_name not in operators_by_name:
            operators_by_name[operator_name] = build_operator(operator_name, document_id, feature_id)

        line_key = (operator_name, line_name)
        if line_key not in lines_by_key:
            operator_id = operators_by_name[operator_name]["id"]
            lines_by_key[line_key] = build_line(operator_name, line_name, operator_id, document_id, feature_id)

    for feature in features:
        if feature["featureClass"] != "Station":
            continue
        properties = feature["properties"]
        operator_name = properties["N02_004"]
        line_name = properties["N02_003"]
        station_name = properties["N02_005"]
        feature_id = feature["featureId"]

        operator = operators_by_name[operator_name]
        line = lines_by_key[(operator_name, line_name)]
        centroid = compute_centroid(feature["geometry"])
        stations.append(
            build_station(
                operator_name,
                line_name,
                station_name,
                feature_id,
                operator["id"],
                line["id"],
                centroid,
                document_id,
            )
        )

    operators = sorted(operators_by_name.values(), key=lambda item: item["id"])
    lines = sorted(lines_by_key.values(), key=lambda item: item["id"])
    stations_sorted = sorted(stations, key=lambda item: item["id"])
    return operators, lines, stations_sorted


def build_operator(operator_name: str, document_id: str, feature_id: str) -> dict[str, Any]:
    operator_id = f"r3d:jp:n02:operator:op-{slug_hash(operator_name)}"
    return {
        "id": operator_id,
        "name": {"ja": operator_name},
        "countryCode": "JP",
        "sourceRefs": [
            {
                "sourceId": document_id,
                "method": "government_open_data",
                "sourceFeatureId": feature_id,
            }
        ],
    }


def build_line(
    operator_name: str, line_name: str, operator_id: str, document_id: str, feature_id: str
) -> dict[str, Any]:
    line_id = f"r3d:jp:n02:line:ln-{slug_hash(operator_name, line_name)}"
    return {
        "id": line_id,
        "operatorIds": [operator_id],
        "name": {"ja": line_name},
        "routeIds": [],
        "serviceStatus": "operational",
        "sourceRefs": [
            {
                "sourceId": document_id,
                "method": "government_open_data",
                "sourceFeatureId": feature_id,
            }
        ],
    }


def build_station(
    operator_name: str,
    line_name: str,
    station_name: str,
    feature_id: str,
    operator_id: str,
    line_id: str,
    centroid: list[float],
    document_id: str,
) -> dict[str, Any]:
    station_id = f"r3d:jp:n02:station:st-{slug_hash(operator_name, line_name, station_name, feature_id)}"
    return {
        "id": station_id,
        "name": {"ja": station_name},
        "operatorIds": [operator_id],
        "lineIds": [line_id],
        "centroid": centroid,
        # N02 is an inventory-only source; it carries no elevation/Z. Stations never get
        # a groundReference and always have an empty levels[] here.
        "levels": [],
        "aliases": [],
        "sourceRefs": [
            {
                "sourceId": document_id,
                "method": "government_open_data",
                "sourceFeatureId": feature_id,
            }
        ],
    }


def compute_centroid(geometry: dict[str, Any]) -> list[float]:
    if geometry["type"] == "Point":
        lng, lat = geometry["coordinates"]
        return [lng, lat]
    # Deterministic choice for LineString station geometry: the midpoint of the first and
    # last coordinate (not a true geometric centroid along the line), since a station's
    # N02 LineString segment is short and this keeps normalization simple and stable.
    coordinates = geometry["coordinates"]
    first_lng, first_lat = coordinates[0]
    last_lng, last_lat = coordinates[-1]
    return [(first_lng + last_lng) / 2, (first_lat + last_lat) / 2]


def slug_hash(*parts: str) -> str:
    return sha256_hex(" ".join(parts).encode("utf-8"))[:12]


def is_lng_lat(value: Any) -> bool:
    if not isinstance(value, list) or len(value) != 2:
        return False
    lng, lat = value
    return is_number(lng) and is_number(lat) and -180 <= lng <= 180 and -90 <= lat <= 90


def summarize_operator(operator: dict[str, Any]) -> dict[str, Any]:
    return {"id": operator["id"], "name": next(iter(operator["name"].values()))}


def summarize_line(line: dict[str, Any], operators: list[dict[str, Any]]) -> dict[str, Any]:
    operator_by_id = {operator["id"]: operator for operator in operators}
    operator_name = next(
        (next(iter(operator_by_id[operator_id]["name"].values())) for operator_id in line["operatorIds"]),
        "",
    )
    return {
        "id": line["id"],
        "operatorName": operator_name,
        "lineName": next(iter(line["name"].values())),
    }


def summarize_station(station: dict[str, Any], lines: list[dict[str, Any]]) -> dict[str, Any]:
    line_by_id = {line["id"]: line for line in lines}
    line_name = next(
        (next(iter(line_by_id[line_id]["name"].values())) for line_id in station["lineIds"]),
        "",
    )
    return {
        "id": station["id"],
        "stationName": next(iter(station["name"].values())),
        "lineName": line_name,
    }


def n02_inventory_report_to_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# N02 Inventory Parse",
        "",
        f"- Document ID: `{report['documentId']}`",
        f"- Title: {report['title']}",
        f"- Synthetic: {format_boolish(report['synthetic'])}",
        f"- Authored by: {report['authoredBy']}",
        f"- Authored at: {report['authoredAt']}",
        f"- License: {report['licenseId']}",
        f"- Redistribution allowed: {format_boolish(report['redistributionAllowed'])}",
        f"- Public redistribution decision: {report['publicRedistributionDecision']}",
        f"- Checksum: `{report['checksum']}`",
        f"- Operators: {report['operatorCount']}",
        f"- Lines: {report['lineCount']}",
        f"- Stations: {report['stationCount']}",
        "",
        "## Lines",
        "",
        "| id | operator | line name |",
        "| --- | --- | --- |",
    ]
    for summary in report["lineSummaries"]:
        lines.append(f"| {summary['id']} | {summary['operatorName']} | {summary['lineName']} |")

    lines.extend(
        [
            "",
            "## Stations",
            "",
            "| id | station name | line |",
            "| --- | --- | --- |",
        ]
    )
    for summary in report["stationSummaries"]:
        lines.append(f"| {summary['id']} | {summary['stationName']} | {summary['lineName']} |")

    return "\n".join(lines) + "\n"
