from __future__ import annotations

import pytest

from railway3d_pipeline.cli import main


def test_help_exits_successfully(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exc_info:
        main(["--help"])

    assert exc_info.value.code == 0
    assert "Railway3D static data pipeline" in capsys.readouterr().out


def test_validate_dataset_cli_accepts_golden_fixture(capsys: pytest.CaptureFixture[str]) -> None:
    result = main(["validate", "dataset", "data/sample/synthetic-golden/v1/dataset.json"])

    assert result == 0
    assert "Validated data/sample/synthetic-golden/v1/dataset.json" in capsys.readouterr().out


def test_source_audit_cli_reports_synthetic_sources(capsys: pytest.CaptureFixture[str]) -> None:
    result = main(["source", "audit", "synthetic-golden"])

    assert result == 0
    assert "Audited sources for synthetic-golden: 2 source(s)" in capsys.readouterr().out


def test_build_region_cli_writes_dataset(tmp_path) -> None:
    result = main(["build", "region", "synthetic-golden", "--output", str(tmp_path)])

    assert result == 0
    assert (tmp_path / "dataset.json").is_file()
    assert (tmp_path / "build-report.json").is_file()


def test_build_region_cli_reports_infeasible_constraint(capsys: pytest.CaptureFixture[str]) -> None:
    result = main(
        [
            "build",
            "region",
            "synthetic-golden",
            "--max-abs-gradient-permille",
            "1",
        ]
    )

    assert result == 1
    assert "INFEASIBLE_CONSTRAINT" in capsys.readouterr().out
