from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from railway3d_pipeline.cli import main
from railway3d_pipeline.json_utils import read_json
from railway3d_pipeline.n02 import (
    load_n02_inventory_document,
    n02_inventory_report_to_markdown,
    parse_n02_inventory_document,
)
from railway3d_pipeline.schema_validation import load_schemas
from railway3d_pipeline.synthetic import PipelineError


SCHEMA_DIR = Path("schemas/v1")
EXAMPLE_PATH = Path("data/sample/n02/v1/example-n02-inventory.json")


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
        "station": Draft202012Validator(
            schema_by_id["https://railway3d.dev/schemas/v1/station.schema.json"], registry=registry
        ),
    }


def expect_pipeline_error(document: dict[str, Any], code: str) -> None:
    try:
        parse_n02_inventory_document(document)
    except PipelineError as error:
        assert error.code == code
    else:
        raise AssertionError(f"Expected PipelineError with code {code}")


def test_parse_example_document_reports_expected_counts() -> None:
    report = load_n02_inventory_document(EXAMPLE_PATH)

    assert report["documentId"] == "n02-sample-inventory-example-2026-07"
    assert report["kind"] == "n02-inventory"
    assert report["synthetic"] is True
    assert report["operatorCount"] == 1
    assert report["lineCount"] == 2
    assert report["stationCount"] == 5
    assert report["publicRedistributionDecision"] == "allowed"
    assert report["checksum"].startswith("sha256:")


def test_normalized_entities_validate_against_schemas() -> None:
    report = load_n02_inventory_document(EXAMPLE_PATH)
    validators = entity_validators()

    for operator in report["operators"]:
        errors = list(validators["operator"].iter_errors(operator))
        assert errors == [], f"{operator['id']}: {[error.message for error in errors]}"

    for line in report["lines"]:
        errors = list(validators["line"].iter_errors(line))
        assert errors == [], f"{line['id']}: {[error.message for error in errors]}"

    for station in report["stations"]:
        errors = list(validators["station"].iter_errors(station))
        assert errors == [], f"{station['id']}: {[error.message for error in errors]}"


def test_no_station_carries_any_elevation() -> None:
    report = load_n02_inventory_document(EXAMPLE_PATH)

    for station in report["stations"]:
        assert "groundReference" not in station
        assert station["levels"] == []


def test_stations_on_same_line_dedup_to_one_line() -> None:
    report = load_n02_inventory_document(EXAMPLE_PATH)

    sample_line_stations = [station for station in report["stations"] if len(station["lineIds"]) == 1]
    line_ids = {station["lineIds"][0] for station in sample_line_stations if station["lineIds"][0]}
    # Two lines total (サンプル線, みらい線), each with multiple stations deduped to one line entry.
    assert len(line_ids) == 2
    assert report["lineCount"] == 2


def test_missing_operator_name_is_rejected() -> None:
    document = load_example_document()
    del document["features"][0]["properties"]["N02_004"]

    expect_pipeline_error(document, "N02_FEATURE_INCOMPLETE")


def test_missing_station_name_is_rejected() -> None:
    document = load_example_document()
    del document["features"][2]["properties"]["N02_005"]

    expect_pipeline_error(document, "N02_FEATURE_INCOMPLETE")


def test_out_of_range_coordinate_is_rejected() -> None:
    document = load_example_document()
    document["features"][2]["geometry"]["coordinates"] = [200.0, 35.65]

    expect_pipeline_error(document, "N02_GEOMETRY_INVALID")


def test_empty_coordinates_are_rejected() -> None:
    document = load_example_document()
    document["features"][0]["geometry"]["coordinates"] = []

    expect_pipeline_error(document, "N02_GEOMETRY_INVALID")


def test_license_without_redistribution_flag_is_rejected() -> None:
    document = load_example_document()
    del document["license"]["redistributionAllowed"]

    expect_pipeline_error(document, "N02_LICENSE_INVALID")


def test_license_blocking_redistribution_reports_blocked_decision() -> None:
    document = load_example_document()
    document["license"]["redistributionAllowed"] = False

    report = parse_n02_inventory_document(document)

    assert report["publicRedistributionDecision"].startswith("blocked")


def test_cli_parse_n02_writes_json_report(tmp_path: Path) -> None:
    output = tmp_path / "n02-inventory.json"

    result = main(["source", "parse-n02", str(EXAMPLE_PATH), "--output", str(output)])

    assert result == 0
    written = read_json(output)
    assert written["operatorCount"] == 1
    assert written["lineCount"] == 2
    assert written["stationCount"] == 5


def test_cli_parse_n02_writes_markdown_report(tmp_path: Path) -> None:
    output = tmp_path / "n02-inventory.md"

    result = main(["source", "parse-n02", str(EXAMPLE_PATH), "--output", str(output)])

    assert result == 0
    assert output.read_text(encoding="utf-8").startswith("#")


def test_markdown_report_contains_document_id() -> None:
    report = load_n02_inventory_document(EXAMPLE_PATH)
    markdown = n02_inventory_report_to_markdown(report)

    assert report["documentId"] in markdown
    assert "## Lines" in markdown
    assert "## Stations" in markdown


def test_deep_copy_document_is_unaffected_by_normalization() -> None:
    # Guard against accidental in-place mutation of the source document during parsing.
    document = load_example_document()
    original = copy.deepcopy(document)

    parse_n02_inventory_document(document)

    assert document == original
