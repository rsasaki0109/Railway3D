from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

from railway3d_pipeline.cli import main
from railway3d_pipeline.gsi_dem import (
    gsi_dem_report_to_markdown,
    load_gsi_dem_grid,
    parse_gsi_dem_grid,
)
from railway3d_pipeline.json_utils import read_json
from railway3d_pipeline.synthetic import PipelineError


EXAMPLE_PATH = Path("data/sample/gsi-dem/v1/example-gsi-dem-grid.json")


def load_example_document() -> dict[str, Any]:
    return read_json(EXAMPLE_PATH)


def expect_pipeline_error(document: dict[str, Any], code: str) -> None:
    try:
        parse_gsi_dem_grid(document)
    except PipelineError as error:
        assert error.code == code
    else:
        raise AssertionError(f"Expected PipelineError with code {code}")


def test_parse_example_document_reports_expected_counts() -> None:
    report = load_gsi_dem_grid(EXAMPLE_PATH)

    assert report["documentId"] == "gsi-dem-sample-grid-example-2026-07"
    assert report["kind"] == "gsi-dem-grid"
    assert report["synthetic"] is True
    assert report["role"] == "ground_elevation"
    assert report["verticalDatum"] == "JGD2011_ORTHOMETRIC"
    assert report["sampleCount"] == 6
    assert report["knownSampleCount"] == 5
    assert report["voidSampleCount"] == 1
    assert report["publicRedistributionDecision"] == "allowed"
    assert report["checksum"].startswith("sha256:")


def test_samples_are_ground_only_never_rail_elevation() -> None:
    report = load_gsi_dem_grid(EXAMPLE_PATH)

    for sample in report["samples"]:
        assert sample["role"] == "ground_elevation"
        assert sample["railElevationM"] is None
        if sample["isVoid"]:
            assert sample["groundElevationM"] is None
            assert "DEM_VOID" in sample["flags"]
        else:
            assert isinstance(sample["groundElevationM"], float)
            assert "MISSING_RAIL_ELEVATION" in sample["flags"]


def test_unknown_vertical_datum_is_rejected() -> None:
    document = load_example_document()
    document["verticalDatum"] = "UNKNOWN"

    expect_pipeline_error(document, "GSI_DEM_DATUM_UNKNOWN")


def test_rail_elevation_role_is_rejected() -> None:
    document = load_example_document()
    document["role"] = "rail_elevation"

    expect_pipeline_error(document, "GSI_DEM_ROLE_INVALID")


def test_mismatched_value_shape_is_rejected() -> None:
    document = load_example_document()
    document["values"] = [[1.0, 2.0]]

    expect_pipeline_error(document, "GSI_DEM_VALUES_INVALID")


def test_invalid_bbox_is_rejected() -> None:
    document = load_example_document()
    document["bbox"] = [139.7, 35.65, 139.7, 35.65]

    expect_pipeline_error(document, "GSI_DEM_BBOX_INVALID")


def test_license_without_redistribution_flag_is_rejected() -> None:
    document = load_example_document()
    del document["license"]["redistributionAllowed"]

    expect_pipeline_error(document, "GSI_DEM_LICENSE_INVALID")


def test_license_blocking_redistribution_reports_blocked_decision() -> None:
    document = load_example_document()
    document["license"]["redistributionAllowed"] = False

    report = parse_gsi_dem_grid(document)

    assert report["publicRedistributionDecision"].startswith("blocked")


def test_cli_parse_gsi_dem_writes_json_report(tmp_path: Path) -> None:
    output = tmp_path / "gsi-dem.json"

    result = main(["source", "parse-gsi-dem", str(EXAMPLE_PATH), "--output", str(output)])

    assert result == 0
    written = read_json(output)
    assert written["sampleCount"] == 6
    assert written["voidSampleCount"] == 1


def test_cli_parse_gsi_dem_writes_markdown_report(tmp_path: Path) -> None:
    output = tmp_path / "gsi-dem.md"

    result = main(["source", "parse-gsi-dem", str(EXAMPLE_PATH), "--output", str(output)])

    assert result == 0
    assert output.read_text(encoding="utf-8").startswith("#")


def test_markdown_report_contains_document_id() -> None:
    report = load_gsi_dem_grid(EXAMPLE_PATH)
    markdown = gsi_dem_report_to_markdown(report)

    assert report["documentId"] in markdown
    assert "ground elevation only" in markdown.lower() or "Ground elevation" in markdown
    assert "railElevationM" in markdown


def test_deep_copy_document_is_unaffected_by_normalization() -> None:
    document = load_example_document()
    original = copy.deepcopy(document)

    parse_gsi_dem_grid(document)

    assert document == original
