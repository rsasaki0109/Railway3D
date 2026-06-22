from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from railway3d_pipeline import __version__
from railway3d_pipeline.json_utils import read_json, sha256_prefixed_json, write_json
from railway3d_pipeline.schema_validation import ValidationIssue, load_schemas, validate_dataset


SYNTHETIC_REGION_ID = "synthetic-golden"
SYNTHETIC_DATASET_PATH = Path("data/sample/synthetic-golden/v1/dataset.json")


@dataclass(frozen=True)
class BuildResult:
    dataset_path: Path
    checksum: str
    report_path: Path


class PipelineError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


def build_synthetic_region(
    region_id: str,
    output_dir: Path,
    schema_dir: Path,
    *,
    max_abs_gradient_permille: float = 60.0,
) -> BuildResult:
    if region_id != SYNTHETIC_REGION_ID:
        raise PipelineError("UNKNOWN_REGION", f"Only {SYNTHETIC_REGION_ID!r} is supported in PR-009.")

    dataset = read_json(SYNTHETIC_DATASET_PATH)
    validate_profile_constraints(dataset, max_abs_gradient_permille)

    issues = validate_dataset(dataset, load_schemas(schema_dir))
    if issues:
        raise PipelineError("DATASET_INVALID", format_issues(issues))

    checksum = sha256_prefixed_json(dataset)
    dataset_path = output_dir / "dataset.json"
    report_path = output_dir / "build-report.json"
    write_json(dataset_path, dataset)
    write_json(
        report_path,
        {
            "builder": "railway3d-pipeline",
            "builderVersion": __version__,
            "checksum": checksum,
            "datasetId": dataset["manifest"]["datasetId"],
            "regionId": region_id,
            "sourceFixture": str(SYNTHETIC_DATASET_PATH),
        },
    )
    return BuildResult(dataset_path=dataset_path, checksum=checksum, report_path=report_path)


def validate_profile_constraints(dataset: dict[str, Any], max_abs_gradient_permille: float) -> None:
    for profile in dataset["profiles"]:
        for sample in profile["samples"]:
            gradient = sample["gradientPermille"]
            if gradient is None:
                continue
            if abs(gradient) > max_abs_gradient_permille:
                raise PipelineError(
                    "INFEASIBLE_CONSTRAINT",
                    (
                        f"Profile {profile['id']} sample {sample['chainageM']} m has gradient "
                        f"{gradient} permille, exceeding maxAbs {max_abs_gradient_permille}."
                    ),
                )


def format_issues(issues: list[ValidationIssue]) -> str:
    return "\n".join(f"{issue.code}: {issue.path}: {issue.message}" for issue in issues)

