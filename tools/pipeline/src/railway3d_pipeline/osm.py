from __future__ import annotations

import math
from pathlib import Path
from typing import Any

from railway3d_pipeline.control_points import DOCUMENT_ID_PATTERN, is_number
from railway3d_pipeline.json_utils import read_json, sha256_hex, sha256_prefixed_json
from railway3d_pipeline.n02 import is_lng_lat
from railway3d_pipeline.source_adapters import adapter_summary
from railway3d_pipeline.source_audit import format_boolish
from railway3d_pipeline.synthetic import PipelineError


REQUIRED_TOP_LEVEL_FIELDS = (
    "documentId",
    "title",
    "synthetic",
    "authoredBy",
    "authoredAt",
    "license",
    "elements",
)

WAY_RAILWAY_VALUES = {"rail", "subway", "light_rail", "tram", "monorail", "narrow_gauge"}
STATION_RAILWAY_VALUES = {"station", "halt", "stop", "tram_stop"}

# Metric elevation must never be inferred from these OSM tag keys.
PROHIBITED_ELEVATION_TAG_KEYS = {
    "ele",
    "ele:wgs84",
    "height",
    "min_height",
    "max_height",
    "building:levels",
    "level",
    "rail_elevation",
    "railElevation",
    "railElevationM",
    "groundElevation",
    "groundElevationM",
}


def load_osm_railway_extract(path: Path) -> dict[str, Any]:
    document = read_json(path)
    return parse_osm_railway_extract(document)


def parse_osm_railway_extract(document: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(document, dict) or document.get("kind") != "osm-railway-extract":
        raise PipelineError(
            "OSM_DOC_INVALID",
            "OSM railway extract document root must be an object with kind 'osm-railway-extract'.",
        )

    missing_fields = [field for field in REQUIRED_TOP_LEVEL_FIELDS if field not in document]
    if missing_fields:
        raise PipelineError(
            "OSM_DOC_INVALID",
            "; ".join(f"missing required field {field!r}" for field in missing_fields),
        )

    document_id = document["documentId"]
    if not isinstance(document_id, str) or not DOCUMENT_ID_PATTERN.match(document_id):
        raise PipelineError(
            "OSM_DOC_INVALID",
            f"documentId {document_id!r} must match ^[a-z0-9][a-z0-9._:-]*$.",
        )

    elements = document["elements"]
    if not isinstance(elements, list):
        raise PipelineError("OSM_DOC_INVALID", "elements must be a list.")

    license_info = document["license"]
    if (
        not isinstance(license_info, dict)
        or not isinstance(license_info.get("id"), str)
        or not isinstance(license_info.get("redistributionAllowed"), bool)
    ):
        raise PipelineError(
            "OSM_LICENSE_INVALID",
            "license must include a string id and a boolean redistributionAllowed.",
        )

    incomplete_messages = collect_element_incompleteness(elements)
    if incomplete_messages:
        raise PipelineError("OSM_ELEMENT_INCOMPLETE", "; ".join(incomplete_messages))

    elevation_messages = collect_prohibited_elevation_use(elements)
    if elevation_messages:
        raise PipelineError("OSM_ELEVATION_PROHIBITED", "; ".join(elevation_messages))

    geometry_messages = collect_geometry_invalidity(elements)
    if geometry_messages:
        raise PipelineError("OSM_GEOMETRY_INVALID", "; ".join(geometry_messages))

    operators, lines, alignments, segments, stations, profiles = build_entities(elements, document_id)
    checksum = sha256_prefixed_json(
        {
            "operators": operators,
            "lines": lines,
            "alignments": alignments,
            "segments": segments,
            "stations": stations,
            "profiles": profiles,
        }
    )
    redistribution_allowed = license_info["redistributionAllowed"]

    return {
        "documentId": document_id,
        "title": document["title"],
        "kind": "osm-railway-extract",
        "synthetic": bool(document["synthetic"]),
        "authoredBy": document["authoredBy"],
        "authoredAt": document["authoredAt"],
        "horizontalCrs": document.get("horizontalCrs", "EPSG:4326"),
        "licenseId": license_info["id"],
        "redistributionAllowed": redistribution_allowed,
        "adapterSpec": adapter_summary("osm-pbf"),
        "operatorCount": len(operators),
        "lineCount": len(lines),
        "alignmentCount": len(alignments),
        "segmentCount": len(segments),
        "stationCount": len(stations),
        "profileCount": len(profiles),
        "publicRedistributionDecision": (
            "allowed"
            if redistribution_allowed
            else "blocked: OSM extract license does not permit public redistribution"
        ),
        "elevationPolicy": (
            "OSM layer/tunnel/bridge/covered/ele tags are structure or annotation hints only; "
            "this adapter never emits railElevation or metric Z from OSM tags."
        ),
        "operators": operators,
        "lines": lines,
        "alignments": alignments,
        "segments": segments,
        "stations": stations,
        "profiles": profiles,
        "segmentSummaries": [summarize_segment(segment) for segment in segments],
        "stationSummaries": [summarize_station(station) for station in stations],
        "checksum": checksum,
    }


def collect_element_incompleteness(elements: list[Any]) -> list[str]:
    messages: list[str] = []
    for index, element in enumerate(elements):
        if not isinstance(element, dict):
            messages.append(f"elements/{index}: element must be an object")
            continue

        element_type = element.get("type")
        if element_type not in {"way", "node"}:
            messages.append(f"elements/{index}: type must be 'way' or 'node'")
            continue

        if not is_number(element.get("id")):
            messages.append(f"elements/{index}: missing numeric id")

        tags = element.get("tags")
        if not isinstance(tags, dict):
            messages.append(f"elements/{index}: missing tags object")
            continue

        railway = tags.get("railway")
        if element_type == "way":
            if railway not in WAY_RAILWAY_VALUES:
                messages.append(
                    f"elements/{index}: way railway tag must be one of {sorted(WAY_RAILWAY_VALUES)}"
                )
            if not tags.get("name"):
                messages.append(f"elements/{index}: way missing tags.name")
        else:
            if railway not in STATION_RAILWAY_VALUES:
                messages.append(
                    f"elements/{index}: node railway tag must be one of {sorted(STATION_RAILWAY_VALUES)}"
                )
            if not tags.get("name"):
                messages.append(f"elements/{index}: station node missing tags.name")
    return messages


def collect_prohibited_elevation_use(elements: list[dict[str, Any]]) -> list[str]:
    messages: list[str] = []
    for index, element in enumerate(elements):
        if not isinstance(element, dict):
            continue
        tags = element.get("tags")
        if not isinstance(tags, dict):
            continue
        for key in PROHIBITED_ELEVATION_TAG_KEYS:
            if key in tags:
                messages.append(
                    f"elements/{index}: tag {key!r} is prohibited; "
                    "OSM must not supply metric rail or ground elevation to this adapter"
                )
        # Explicit 3D coordinates are rejected so Z cannot leak into geometry.
        geometry = element.get("geometry")
        if isinstance(geometry, dict):
            coordinates = geometry.get("coordinates")
            if geometry.get("type") == "Point" and isinstance(coordinates, list) and len(coordinates) > 2:
                messages.append(f"elements/{index}: 3D Point coordinates are prohibited")
            if geometry.get("type") == "LineString" and isinstance(coordinates, list):
                for point_index, point in enumerate(coordinates):
                    if isinstance(point, list) and len(point) > 2:
                        messages.append(
                            f"elements/{index}: 3D LineString coordinate {point_index} is prohibited"
                        )
    return messages


def collect_geometry_invalidity(elements: list[dict[str, Any]]) -> list[str]:
    messages: list[str] = []
    for index, element in enumerate(elements):
        if not isinstance(element, dict):
            continue
        geometry = element.get("geometry")
        if not isinstance(geometry, dict):
            messages.append(f"elements/{index}: missing geometry")
            continue

        if element.get("type") == "way":
            if geometry.get("type") != "LineString":
                messages.append(f"elements/{index}: way geometry type must be LineString")
                continue
            coordinates = geometry.get("coordinates")
            if not isinstance(coordinates, list) or len(coordinates) < 2:
                messages.append(f"elements/{index}: LineString requires at least 2 coordinates")
                continue
            for point_index, point in enumerate(coordinates):
                if not is_lng_lat(point):
                    messages.append(
                        f"elements/{index}: coordinate {point_index} must be a [lng, lat] pair within range"
                    )
        else:
            if geometry.get("type") != "Point":
                messages.append(f"elements/{index}: node geometry type must be Point")
                continue
            if not is_lng_lat(geometry.get("coordinates")):
                messages.append(f"elements/{index}: Point coordinates must be a [lng, lat] pair within range")
    return messages


def build_entities(
    elements: list[dict[str, Any]], document_id: str
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    operators_by_name: dict[str, dict[str, Any]] = {}
    lines_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    alignments: list[dict[str, Any]] = []
    segments: list[dict[str, Any]] = []
    stations: list[dict[str, Any]] = []
    profiles: list[dict[str, Any]] = []

    for element in elements:
        tags = element["tags"]
        operator_name = str(tags.get("operator") or "unknown-operator")
        if operator_name not in operators_by_name:
            operators_by_name[operator_name] = build_operator(operator_name, document_id, element)

        if element["type"] == "way":
            line_name = str(tags["name"])
            line_key = (operator_name, line_name)
            if line_key not in lines_by_key:
                operator_id = operators_by_name[operator_name]["id"]
                lines_by_key[line_key] = build_line(operator_name, line_name, operator_id, document_id, element)

            line = lines_by_key[line_key]
            alignment, segment, profile = build_way_entities(
                element, line["id"], operators_by_name[operator_name]["id"], document_id
            )
            alignments.append(alignment)
            segments.append(segment)
            profiles.append(profile)

    for element in elements:
        if element["type"] != "node":
            continue
        tags = element["tags"]
        operator_name = str(tags.get("operator") or "unknown-operator")
        operator = operators_by_name[operator_name]
        # Stations attach to all lines of the same operator when line association is unknown.
        line_ids = [
            line["id"]
            for (op_name, _line_name), line in lines_by_key.items()
            if op_name == operator_name
        ]
        stations.append(build_station(element, operator["id"], line_ids, document_id))

    operators = sorted(operators_by_name.values(), key=lambda item: item["id"])
    lines = sorted(lines_by_key.values(), key=lambda item: item["id"])
    alignments_sorted = sorted(alignments, key=lambda item: item["id"])
    segments_sorted = sorted(segments, key=lambda item: item["id"])
    stations_sorted = sorted(stations, key=lambda item: item["id"])
    profiles_sorted = sorted(profiles, key=lambda item: item["id"])
    return operators, lines, alignments_sorted, segments_sorted, stations_sorted, profiles_sorted


def build_operator(operator_name: str, document_id: str, element: dict[str, Any]) -> dict[str, Any]:
    operator_id = f"r3d:jp:osm:operator:op-{slug_hash(operator_name)}"
    return {
        "id": operator_id,
        "name": {"ja": operator_name},
        "countryCode": "JP",
        "sourceRefs": [
            {
                "sourceId": document_id,
                "method": "community_verified",
                "sourceFeatureId": feature_id_for(element),
            }
        ],
    }


def build_line(
    operator_name: str,
    line_name: str,
    operator_id: str,
    document_id: str,
    element: dict[str, Any],
) -> dict[str, Any]:
    line_id = f"r3d:jp:osm:line:ln-{slug_hash(operator_name, line_name)}"
    return {
        "id": line_id,
        "operatorIds": [operator_id],
        "name": {"ja": line_name},
        "routeIds": [],
        "serviceStatus": "operational",
        "sourceRefs": [
            {
                "sourceId": document_id,
                "method": "community_verified",
                "sourceFeatureId": feature_id_for(element),
            }
        ],
    }


def build_way_entities(
    element: dict[str, Any], line_id: str, operator_id: str, document_id: str
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    del line_id, operator_id  # line/operator linkage is via parent report collections
    way_id = str(int(element["id"]))
    tags = element["tags"]
    coordinates = element["geometry"]["coordinates"]
    length_m = line_string_length_m(coordinates)
    structure = structure_from_tags(tags)
    structure_flags = structure_quality_flags(tags)

    alignment_id = f"r3d:jp:osm:alignment:al-{slug_hash(way_id)}"
    segment_id = f"r3d:jp:osm:segment:sg-{slug_hash(way_id)}"
    profile_id = f"r3d:jp:osm:profile:pf-{slug_hash(way_id)}"
    from_node_id = f"r3d:jp:osm:node:nd-{slug_hash(way_id, 'from')}"
    to_node_id = f"r3d:jp:osm:node:nd-{slug_hash(way_id, 'to')}"

    alignment = {
        "id": alignment_id,
        "name": {"ja": str(tags["name"])},
        "role": "representative_centerline",
        "segmentIds": [segment_id],
        "sourceRefs": [
            {
                "sourceId": document_id,
                "method": "community_verified",
                "sourceFeatureId": feature_id_for(element),
            }
        ],
    }

    segment = {
        "id": segment_id,
        "alignmentId": alignment_id,
        "from": {"nodeId": from_node_id, "position": list(coordinates[0])},
        "to": {"nodeId": to_node_id, "position": list(coordinates[-1])},
        "geometry": {"type": "LineString", "coordinates": [list(point) for point in coordinates]},
        "lengthM": length_m,
        "structure": structure,
        "serviceStatus": "operational",
        "profileId": profile_id,
        "sourceRefs": [
            {
                "sourceId": document_id,
                "method": "community_verified",
                "sourceFeatureId": feature_id_for(element),
            }
        ],
        "qualityFlags": structure_flags + ["MISSING_RAIL_ELEVATION"],
    }

    samples = []
    cumulative = 0.0
    previous = coordinates[0]
    for index, point in enumerate(coordinates):
        if index > 0:
            cumulative += haversine_m(previous, point)
            previous = point
        samples.append(
            {
                "chainageM": cumulative,
                "position": list(point),
                "railElevationM": None,
                "groundElevationM": None,
                "clearanceM": None,
                "gradientPermille": None,
                "structure": structure,
                "confidence": "unknown",
                "method": "unknown",
                "provenance": [
                    {
                        "sourceId": document_id,
                        "method": "community_verified",
                        "sourceFeatureId": feature_id_for(element),
                    }
                ],
                "flags": ["MISSING_RAIL_ELEVATION", "MISSING_GROUND_ELEVATION"],
            }
        )

    profile = {
        "id": profile_id,
        "ownerType": "segment",
        "ownerId": segment_id,
        "verticalDatum": "UNKNOWN",
        "sampleIntervalTargetM": max(length_m / max(len(coordinates) - 1, 1), 1.0),
        "totalLengthM": length_m if length_m > 0 else 1.0,
        "samples": samples,
        "aggregateQuality": {
            "knownRailElevationRatio": 0.0,
            "publishedControlCoverageRatio": 0.0,
            "confidence": "unknown",
            "flags": ["MISSING_RAIL_ELEVATION", "MISSING_GROUND_ELEVATION"],
        },
    }

    # lengthM must be exclusiveMinimum 0 for segments; extremely short synthetic edges stay positive.
    if segment["lengthM"] <= 0:
        segment["lengthM"] = 1.0
        profile["totalLengthM"] = 1.0

    return alignment, segment, profile


def build_station(
    element: dict[str, Any], operator_id: str, line_ids: list[str], document_id: str
) -> dict[str, Any]:
    tags = element["tags"]
    station_name = str(tags["name"])
    feature_id = feature_id_for(element)
    station_id = f"r3d:jp:osm:station:st-{slug_hash(station_name, feature_id)}"
    return {
        "id": station_id,
        "name": {"ja": station_name},
        "operatorIds": [operator_id],
        "lineIds": line_ids,
        "centroid": list(element["geometry"]["coordinates"]),
        # OSM is not a rail elevation source. Never emit groundReference or elevated levels.
        "levels": [],
        "aliases": [],
        "sourceRefs": [
            {
                "sourceId": document_id,
                "method": "community_verified",
                "sourceFeatureId": feature_id,
            }
        ],
    }


def structure_from_tags(tags: dict[str, Any]) -> str:
    if is_truthy_tag(tags.get("tunnel")):
        return "underground_tunnel"
    if is_truthy_tag(tags.get("bridge")):
        return "bridge"
    if is_truthy_tag(tags.get("embankment")):
        return "embankment"
    if is_truthy_tag(tags.get("cutting")):
        return "cutting"
    if is_truthy_tag(tags.get("covered")):
        # Covered is a structure hint, not a Z value; map conservatively.
        return "unknown"
    return "surface"


def structure_quality_flags(tags: dict[str, Any]) -> list[str]:
    flags: list[str] = []
    # layer is an ordering hint, never meters. Surface it as needing review when present.
    if "layer" in tags:
        flags.append("MANUAL_REVIEW_REQUIRED")
    if is_truthy_tag(tags.get("covered")) and not is_truthy_tag(tags.get("tunnel")):
        flags.append("MANUAL_REVIEW_REQUIRED")
    return flags


def is_truthy_tag(value: Any) -> bool:
    if value is True:
        return True
    if not isinstance(value, str):
        return False
    return value.strip().lower() not in {"", "no", "false", "0", "none"}


def feature_id_for(element: dict[str, Any]) -> str:
    return f"{element['type']}/{int(element['id'])}"


def line_string_length_m(coordinates: list[list[float]]) -> float:
    total = 0.0
    for index in range(1, len(coordinates)):
        total += haversine_m(coordinates[index - 1], coordinates[index])
    return total


def haversine_m(a: list[float], b: list[float]) -> float:
    lng1, lat1 = math.radians(a[0]), math.radians(a[1])
    lng2, lat2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * 6371000.0 * math.asin(min(1.0, math.sqrt(h)))


def slug_hash(*parts: str) -> str:
    return sha256_hex(" ".join(parts).encode("utf-8"))[:12]


def summarize_segment(segment: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": segment["id"],
        "structure": segment["structure"],
        "lengthM": segment["lengthM"],
        "qualityFlags": segment["qualityFlags"],
    }


def summarize_station(station: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": station["id"],
        "stationName": next(iter(station["name"].values())),
        "centroid": station["centroid"],
    }


def osm_extract_report_to_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# OSM Railway Extract Parse",
        "",
        f"- Document ID: `{report['documentId']}`",
        f"- Title: {report['title']}",
        f"- Synthetic: {format_boolish(report['synthetic'])}",
        f"- Authored by: {report['authoredBy']}",
        f"- Authored at: {report['authoredAt']}",
        f"- Horizontal CRS: {report['horizontalCrs']}",
        f"- License: {report['licenseId']}",
        f"- Redistribution allowed: {format_boolish(report['redistributionAllowed'])}",
        f"- Public redistribution decision: {report['publicRedistributionDecision']}",
        f"- Elevation policy: {report['elevationPolicy']}",
        f"- Checksum: `{report['checksum']}`",
        f"- Operators: {report['operatorCount']}",
        f"- Lines: {report['lineCount']}",
        f"- Alignments: {report['alignmentCount']}",
        f"- Segments: {report['segmentCount']}",
        f"- Stations: {report['stationCount']}",
        f"- Profiles (elevation-null stubs): {report['profileCount']}",
        "",
        "## Segments",
        "",
        "| id | structure | lengthM | quality flags |",
        "| --- | --- | --- | --- |",
    ]
    for summary in report["segmentSummaries"]:
        flags = ", ".join(summary["qualityFlags"]) if summary["qualityFlags"] else ""
        lines.append(
            f"| {summary['id']} | {summary['structure']} | {summary['lengthM']:.1f} | {flags} |"
        )

    lines.extend(
        [
            "",
            "## Stations",
            "",
            "| id | station name | centroid |",
            "| --- | --- | --- |",
        ]
    )
    for summary in report["stationSummaries"]:
        centroid = f"[{summary['centroid'][0]}, {summary['centroid'][1]}]"
        lines.append(f"| {summary['id']} | {summary['stationName']} | {centroid} |")

    return "\n".join(lines) + "\n"
