from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

from railway3d_pipeline.cli import main
from railway3d_pipeline.corridor import (
    PILOT_CORRIDOR_PATH,
    corridor_plan_to_markdown,
    load_pilot_corridor_selection,
    parse_pilot_corridor_selection,
    write_corridor_plan,
)
from railway3d_pipeline.json_utils import read_json
from railway3d_pipeline.source_registry import fetch_source
from railway3d_pipeline.synthetic import PipelineError


def load_example_document() -> dict[str, Any]:
    return read_json(PILOT_CORRIDOR_PATH)


def expect_pipeline_error(document: dict[str, Any], code: str) -> None:
    try:
        parse_pilot_corridor_selection(document)
    except PipelineError as error:
        assert error.code == code
    else:
        raise AssertionError(f"Expected PipelineError with code {code}")


def test_load_pilot_corridor_selection() -> None:
    report = load_pilot_corridor_selection()

    assert report["regionId"] == "jp-tokyo-metro"
    assert report["selectionStatus"] == "geometry-inventory-pilot"
    assert report["corridor"]["id"] == "jp-tokyo-metro-ginza-ueno-asakusa"
    assert report["corridor"]["fromStation"] == "上野"
    assert report["corridor"]["toStation"] == "浅草"
    assert report["publicPackageDecision"].startswith("blocked")
    assert report["checksum"].startswith("sha256:")
    assert set(report["fixedSnapshots"]) == {
        "n02",
        "osm-pbf",
        "gsi-dem",
        "manual-control-points",
    }


def test_required_criteria_must_pass() -> None:
    document = load_example_document()
    document["criteriaResults"]["inventory-candidate"]["status"] = "fail"

    expect_pipeline_error(document, "CORRIDOR_CRITERIA_FAILED")


def test_public_package_must_remain_blocked() -> None:
    document = load_example_document()
    document["publicPackageDecision"] = "allowed"

    expect_pipeline_error(document, "CORRIDOR_PACKAGE_NOT_BLOCKED")


def test_fetched_real_snapshots_are_rejected() -> None:
    document = load_example_document()
    document["fixedSnapshots"]["n02"]["status"] = "fetched"

    expect_pipeline_error(document, "CORRIDOR_SNAPSHOTS_INVALID")


def test_control_points_must_remain_blocked() -> None:
    document = load_example_document()
    document["fixedSnapshots"]["manual-control-points"]["status"] = "approved"

    expect_pipeline_error(document, "CORRIDOR_SNAPSHOTS_INVALID")


def test_write_corridor_plan(tmp_path: Path) -> None:
    result = write_corridor_plan("jp-tokyo-metro", tmp_path)

    assert result["corridorId"] == "jp-tokyo-metro-ginza-ueno-asakusa"
    assert (tmp_path / "pilot-corridor-plan.json").is_file()
    assert (tmp_path / "pilot-corridor-plan.md").is_file()
    markdown = (tmp_path / "pilot-corridor-plan.md").read_text(encoding="utf-8")
    assert "# Tokyo Metro Pilot Corridor Plan" in markdown
    assert "上野" in markdown or "Ueno" in markdown


def test_cli_plan_corridor(tmp_path: Path) -> None:
    result = main(
        ["source", "plan-corridor", "jp-tokyo-metro", "--output", str(tmp_path / "plan")]
    )

    assert result == 0
    assert (tmp_path / "plan" / "pilot-corridor-plan.json").is_file()


def test_fetch_tokyo_metro_writes_corridor_plan_only(tmp_path: Path) -> None:
    report = fetch_source("jp-tokyo-metro", tmp_path)

    assert report["kind"] == "corridor-plan-only"
    assert report["corridorId"] == "jp-tokyo-metro-ginza-ueno-asakusa"
    assert (tmp_path / "pilot-corridor-plan.json").is_file()
    # Real source snapshots are still not fetched.
    assert not (tmp_path / "synthetic-golden-source-snapshot.json").exists()


def test_markdown_contains_gates() -> None:
    report = load_pilot_corridor_selection()
    markdown = corridor_plan_to_markdown(report)

    assert "Unresolved gates" in markdown
    assert "Fixed snapshots" in markdown


def test_deep_copy_document_is_unaffected() -> None:
    document = load_example_document()
    original = copy.deepcopy(document)

    parse_pilot_corridor_selection(document)

    assert document == original
