from __future__ import annotations

import copy
from pathlib import Path

import pytest

from railway3d_pipeline.diffing import diff_dataset_files
from railway3d_pipeline.json_utils import read_json, write_json
from railway3d_pipeline.packaging import package_dataset
from railway3d_pipeline.schema_validation import load_schemas, validate_dataset
from railway3d_pipeline.synthetic import PipelineError, build_synthetic_region


SCHEMA_DIR = Path("schemas/v1")
FIXTURE_PATH = Path("data/sample/synthetic-golden/v1/dataset.json")


def test_synthetic_build_has_deterministic_checksum_across_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    first = build_synthetic_region("synthetic-golden", tmp_path / "first", SCHEMA_DIR)
    monkeypatch.setenv("TZ", "Pacific/Honolulu")
    monkeypatch.setenv("LC_ALL", "C")
    second = build_synthetic_region("synthetic-golden", tmp_path / "second", SCHEMA_DIR)

    assert first.checksum == second.checksum
    assert (tmp_path / "first" / "dataset.json").read_bytes() == (
        tmp_path / "second" / "dataset.json"
    ).read_bytes()


def test_diff_reports_identical_generated_fixture(tmp_path: Path) -> None:
    build = build_synthetic_region("synthetic-golden", tmp_path / "build", SCHEMA_DIR)

    diff = diff_dataset_files(FIXTURE_PATH, build.dataset_path)

    assert diff["sameChecksum"] is True
    assert diff["changedCounts"] == {}


def test_unknown_vertical_datum_refuses_clearance_calculation() -> None:
    dataset = copy.deepcopy(read_json(FIXTURE_PATH))
    dataset["profiles"][0]["verticalDatum"] = "UNKNOWN"

    issues = validate_dataset(dataset, load_schemas(SCHEMA_DIR))

    assert "VERTICAL_DATUM_UNKNOWN_DEPTH" in [issue.code for issue in issues]


def test_package_includes_only_used_sources(tmp_path: Path) -> None:
    dataset_path = tmp_path / "dataset.json"
    write_json(dataset_path, read_json(FIXTURE_PATH))

    manifest = package_dataset(dataset_path, tmp_path / "package", public=True)
    licenses = read_json(tmp_path / "package" / "licenses.json")

    assert manifest["usedSourceIds"] == [
        "synthetic-authoring-2026-06",
        "synthetic-review-2026-06",
    ]
    assert [source["sourceId"] for source in licenses["sources"]] == manifest["usedSourceIds"]


def test_public_package_rejects_non_redistributable_used_source(tmp_path: Path) -> None:
    dataset = copy.deepcopy(read_json(FIXTURE_PATH))
    dataset["sources"][0]["license"]["redistributionAllowed"] = False
    dataset_path = tmp_path / "dataset.json"
    write_json(dataset_path, dataset)

    with pytest.raises(PipelineError) as exc_info:
        package_dataset(dataset_path, tmp_path / "package", public=True)

    assert exc_info.value.code == "NON_REDISTRIBUTABLE_SOURCE"
