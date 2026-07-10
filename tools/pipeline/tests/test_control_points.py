from __future__ import annotations

from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from railway3d_pipeline.cli import main
from railway3d_pipeline.control_points import (
    control_point_report_to_markdown,
    ingest_control_point_document,
    load_control_point_document,
)
from railway3d_pipeline.json_utils import read_json
from railway3d_pipeline.schema_validation import load_schemas
from railway3d_pipeline.synthetic import PipelineError


SCHEMA_DIR = Path("schemas/v1")
EXAMPLE_PATH = Path("data/sample/manual-control-points/v1/example-control-points.json")


def load_example_document() -> dict[str, Any]:
    return read_json(EXAMPLE_PATH)


def control_point_validator() -> Draft202012Validator:
    schemas = load_schemas(SCHEMA_DIR)
    schema_by_id = {schema["$id"]: schema for schema in schemas}
    registry = Registry().with_resources(
        (schema_id, Resource.from_contents(schema)) for schema_id, schema in schema_by_id.items()
    )
    control_point_schema = schema_by_id["https://railway3d.dev/schemas/v1/control-point.schema.json"]
    return Draft202012Validator(control_point_schema, registry=registry)


def expect_pipeline_error(document: dict[str, Any], code: str) -> None:
    try:
        ingest_control_point_document(document)
    except PipelineError as error:
        assert error.code == code
    else:
        raise AssertionError(f"Expected PipelineError with code {code}")


def test_ingest_example_document_reports_expected_counts() -> None:
    report = load_control_point_document(EXAMPLE_PATH)

    assert report["documentId"] == "manual-control-points-example-2026-07"
    assert report["kind"] == "manual-control-points"
    assert report["synthetic"] is True
    assert report["controlPointCount"] == 5
    assert report["publicRedistributionDecision"] == "allowed"
    assert report["checksum"].startswith("sha256:")


def test_normalized_control_points_validate_against_schema() -> None:
    report = load_control_point_document(EXAMPLE_PATH)
    validator = control_point_validator()

    for control_point in report["controlPoints"]:
        errors = list(validator.iter_errors(control_point))
        assert errors == [], f"{control_point['id']}: {[error.message for error in errors]}"


def test_unknown_datum_with_elevation_point_is_rejected() -> None:
    document = load_example_document()
    document["verticalDatum"] = "UNKNOWN"

    expect_pipeline_error(document, "MANUAL_CONTROL_DATUM_UNKNOWN")


def test_missing_definition_is_rejected() -> None:
    document = load_example_document()
    del document["points"][0]["definition"]

    expect_pipeline_error(document, "MANUAL_CONTROL_POINT_INCOMPLETE")


def test_missing_source_citation_on_elevation_point_is_rejected() -> None:
    document = load_example_document()
    del document["points"][0]["sourceCitation"]

    expect_pipeline_error(document, "MANUAL_CONTROL_POINT_INCOMPLETE")


def test_duplicate_point_id_is_rejected() -> None:
    document = load_example_document()
    document["points"][1]["id"] = document["points"][0]["id"]

    expect_pipeline_error(document, "MANUAL_CONTROL_DUPLICATE_ID")


def test_non_monotonic_chainage_is_rejected() -> None:
    document = load_example_document()
    # points[0] and points[1] share ownerId "example-line-a"; force non-increasing chainage.
    document["points"][1]["chainageM"] = document["points"][0]["chainageM"]

    expect_pipeline_error(document, "MANUAL_CONTROL_CHAINAGE_NOT_MONOTONIC")


def test_license_without_redistribution_flag_is_rejected() -> None:
    document = load_example_document()
    del document["license"]["redistributionAllowed"]

    expect_pipeline_error(document, "MANUAL_CONTROL_LICENSE_INVALID")


def test_license_blocking_redistribution_reports_blocked_decision() -> None:
    document = load_example_document()
    document["license"]["redistributionAllowed"] = False

    report = ingest_control_point_document(document)

    assert report["publicRedistributionDecision"].startswith("blocked")


def test_cli_ingest_writes_json_report(tmp_path: Path) -> None:
    output = tmp_path / "control-points.json"

    result = main(["source", "ingest", str(EXAMPLE_PATH), "--output", str(output)])

    assert result == 0
    written = read_json(output)
    assert written["controlPointCount"] == 5


def test_cli_ingest_writes_markdown_report(tmp_path: Path) -> None:
    output = tmp_path / "control-points.md"

    result = main(["source", "ingest", str(EXAMPLE_PATH), "--output", str(output)])

    assert result == 0
    assert output.read_text(encoding="utf-8").startswith("#")


def test_markdown_report_contains_document_id() -> None:
    report = load_control_point_document(EXAMPLE_PATH)
    markdown = control_point_report_to_markdown(report)

    assert report["documentId"] in markdown
    assert "## Control Points" in markdown
