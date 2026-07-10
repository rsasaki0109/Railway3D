from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from railway3d_pipeline.cli import main
from railway3d_pipeline.json_utils import read_json
from railway3d_pipeline.osm import (
    load_osm_railway_extract,
    osm_extract_report_to_markdown,
    parse_osm_railway_extract,
)
from railway3d_pipeline.schema_validation import load_schemas
from railway3d_pipeline.synthetic import PipelineError


SCHEMA_DIR = Path("schemas/v1")
EXAMPLE_PATH = Path("data/sample/osm/v1/example-osm-railway-extract.json")


def load_example_document() -> dict[str, Any]:
    return read_json(EXAMPLE_PATH)


def entity_validators() -> dict[str, Draft202012Validator]:
    schemas = load_schemas(SCHEMA_DIR)
    schema_by_id = {schema["$id"]: schema for schema in schemas}
    registry = Registry().with_resources(
        (schema_id, Resource.from_contents(schema)) for schema_id, schema in schema_by_id.items()
    )
    return {
        "operator": Draft202012Validator(
            schema_by_id["https://railway3d.dev/schemas/v1/operator.schema.json"], registry=registry
        ),
        "line": Draft202012Validator(
            schema_by_id["https://railway3d.dev/schemas/v1/line.schema.json"], registry=registry
        ),
        "alignment": Draft202012Validator(
            schema_by_id["https://railway3d.dev/schemas/v1/alignment.schema.json"], registry=registry
        ),
        "segment": Draft202012Validator(
            schema_by_id["https://railway3d.dev/schemas/v1/segment.schema.json"], registry=registry
        ),
        "station": Draft202012Validator(
            schema_by_id["https://railway3d.dev/schemas/v1/station.schema.json"], registry=registry
        ),
        "profile": Draft202012Validator(
            schema_by_id["https://railway3d.dev/schemas/v1/profile.schema.json"], registry=registry
        ),
    }


def expect_pipeline_error(document: dict[str, Any], code: str) -> None:
    try:
        parse_osm_railway_extract(document)
    except PipelineError as error:
        assert error.code == code
    else:
        raise AssertionError(f"Expected PipelineError with code {code}")


def test_parse_example_document_reports_expected_counts() -> None:
    report = load_osm_railway_extract(EXAMPLE_PATH)

    assert report["documentId"] == "osm-sample-railway-extract-example-2026-07"
    assert report["kind"] == "osm-railway-extract"
    assert report["synthetic"] is True
    assert report["operatorCount"] == 1
    assert report["lineCount"] == 3
    assert report["alignmentCount"] == 3
    assert report["segmentCount"] == 3
    assert report["stationCount"] == 3
    assert report["profileCount"] == 3
    assert report["publicRedistributionDecision"] == "allowed"
    assert report["checksum"].startswith("sha256:")


def test_normalized_entities_validate_against_schemas() -> None:
    report = load_osm_railway_extract(EXAMPLE_PATH)
    validators = entity_validators()

    for key in ("operators", "lines", "alignments", "segments", "stations", "profiles"):
        singular = key[:-1] if key.endswith("s") else key
        if key == "alignments":
            singular = "alignment"
        elif key == "profiles":
            singular = "profile"
        for entity in report[key]:
            errors = list(validators[singular].iter_errors(entity))
            assert errors == [], f"{entity.get('id', entity)}: {[error.message for error in errors]}"


def test_structure_tags_map_without_metric_z() -> None:
    report = load_osm_railway_extract(EXAMPLE_PATH)
    structures = {segment["structure"] for segment in report["segments"]}

    assert "underground_tunnel" in structures
    assert "bridge" in structures
    assert "surface" in structures

    for segment in report["segments"]:
        assert "MISSING_RAIL_ELEVATION" in segment["qualityFlags"]

    for profile in report["profiles"]:
        for sample in profile["samples"]:
            assert sample["railElevationM"] is None
            assert sample["groundElevationM"] is None


def test_stations_never_carry_elevation() -> None:
    report = load_osm_railway_extract(EXAMPLE_PATH)

    for station in report["stations"]:
        assert "groundReference" not in station
        assert station["levels"] == []


def test_layer_tag_is_not_converted_to_elevation() -> None:
    report = load_osm_railway_extract(EXAMPLE_PATH)
    tunnel_segments = [segment for segment in report["segments"] if segment["structure"] == "underground_tunnel"]

    assert tunnel_segments
    assert "MANUAL_REVIEW_REQUIRED" in tunnel_segments[0]["qualityFlags"]
    for profile in report["profiles"]:
        for sample in profile["samples"]:
            assert sample["railElevationM"] is None


def test_ele_tag_is_rejected() -> None:
    document = load_example_document()
    document["elements"][0]["tags"]["ele"] = "12.5"

    expect_pipeline_error(document, "OSM_ELEVATION_PROHIBITED")


def test_3d_coordinates_are_rejected() -> None:
    document = load_example_document()
    document["elements"][0]["geometry"]["coordinates"][0] = [139.701, 35.651, 12.5]

    expect_pipeline_error(document, "OSM_ELEVATION_PROHIBITED")


def test_missing_way_name_is_rejected() -> None:
    document = load_example_document()
    del document["elements"][0]["tags"]["name"]

    expect_pipeline_error(document, "OSM_ELEMENT_INCOMPLETE")


def test_out_of_range_coordinate_is_rejected() -> None:
    document = load_example_document()
    document["elements"][3]["geometry"]["coordinates"] = [200.0, 35.65]

    expect_pipeline_error(document, "OSM_GEOMETRY_INVALID")


def test_license_without_redistribution_flag_is_rejected() -> None:
    document = load_example_document()
    del document["license"]["redistributionAllowed"]

    expect_pipeline_error(document, "OSM_LICENSE_INVALID")


def test_license_blocking_redistribution_reports_blocked_decision() -> None:
    document = load_example_document()
    document["license"]["redistributionAllowed"] = False

    report = parse_osm_railway_extract(document)

    assert report["publicRedistributionDecision"].startswith("blocked")


def test_cli_parse_osm_writes_json_report(tmp_path: Path) -> None:
    output = tmp_path / "osm-extract.json"

    result = main(["source", "parse-osm", str(EXAMPLE_PATH), "--output", str(output)])

    assert result == 0
    written = read_json(output)
    assert written["segmentCount"] == 3
    assert written["stationCount"] == 3


def test_cli_parse_osm_writes_markdown_report(tmp_path: Path) -> None:
    output = tmp_path / "osm-extract.md"

    result = main(["source", "parse-osm", str(EXAMPLE_PATH), "--output", str(output)])

    assert result == 0
    assert output.read_text(encoding="utf-8").startswith("#")


def test_markdown_report_contains_document_id() -> None:
    report = load_osm_railway_extract(EXAMPLE_PATH)
    markdown = osm_extract_report_to_markdown(report)

    assert report["documentId"] in markdown
    assert "## Segments" in markdown
    assert "## Stations" in markdown
    assert "Elevation policy" in markdown or "elevation policy" in markdown.lower()


def test_deep_copy_document_is_unaffected_by_normalization() -> None:
    document = load_example_document()
    original = copy.deepcopy(document)

    parse_osm_railway_extract(document)

    assert document == original
