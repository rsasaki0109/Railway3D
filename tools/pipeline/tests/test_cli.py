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
