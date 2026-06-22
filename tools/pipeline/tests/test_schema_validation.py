from __future__ import annotations

import copy
from pathlib import Path

from railway3d_pipeline.schema_validation import load_schemas, read_json, validate_dataset


SCHEMA_DIR = Path("schemas/v1")
FIXTURE_PATH = Path("data/sample/synthetic-golden/v1/dataset.json")


def load_fixture() -> dict:
    return read_json(FIXTURE_PATH)


def issue_codes(dataset: dict) -> list[str]:
    return [issue.code for issue in validate_dataset(dataset, load_schemas(SCHEMA_DIR))]


def test_valid_fixture_is_accepted() -> None:
    assert validate_dataset(load_fixture(), load_schemas(SCHEMA_DIR)) == []


def test_missing_datum_is_rejected() -> None:
    dataset = copy.deepcopy(load_fixture())
    del dataset["profiles"][0]["verticalDatum"]

    assert "SCHEMA_INVALID" in issue_codes(dataset)


def test_invalid_coordinate_is_rejected() -> None:
    dataset = copy.deepcopy(load_fixture())
    dataset["stations"][0]["centroid"] = [181, 91]

    assert "SCHEMA_INVALID" in issue_codes(dataset)


def test_dangling_reference_is_rejected() -> None:
    dataset = copy.deepcopy(load_fixture())
    dataset["routes"][0]["lineId"] = "r3d:zz:synthetic:line:missing"

    assert "DANGLING_REFERENCE" in issue_codes(dataset)


def test_dangling_source_reference_is_rejected() -> None:
    dataset = copy.deepcopy(load_fixture())
    dataset["profiles"][0]["samples"][0]["provenance"][0]["sourceId"] = "synthetic-missing"

    assert "DANGLING_SOURCE_REFERENCE" in issue_codes(dataset)


def test_hard_control_point_mismatch_is_rejected() -> None:
    dataset = copy.deepcopy(load_fixture())
    dataset["profiles"][0]["samples"][0]["railElevationM"] = -17

    assert "HARD_CONTROL_MISMATCH" in issue_codes(dataset)


def test_high_confidence_without_provenance_is_rejected() -> None:
    dataset = copy.deepcopy(load_fixture())
    dataset["profiles"][0]["samples"][1]["provenance"] = []

    assert "SCHEMA_INVALID" in issue_codes(dataset)


def test_null_rail_elevation_is_accepted() -> None:
    dataset = load_fixture()

    assert any(sample["railElevationM"] is None for sample in dataset["profiles"][0]["samples"])
    assert validate_dataset(dataset, load_schemas(SCHEMA_DIR)) == []
