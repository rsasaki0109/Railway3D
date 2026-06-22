from __future__ import annotations

from pathlib import Path
from typing import Any

from railway3d_pipeline.json_utils import read_json, sha256_prefixed_json


def diff_dataset_files(left_path: Path, right_path: Path) -> dict[str, Any]:
    left = read_json(left_path)
    right = read_json(right_path)
    left_counts = entity_counts(left)
    right_counts = entity_counts(right)
    changed_counts = {
        key: {"from": left_counts[key], "to": right_counts[key]}
        for key in sorted(left_counts)
        if left_counts[key] != right_counts[key]
    }
    return {
        "left": str(left_path),
        "right": str(right_path),
        "leftChecksum": sha256_prefixed_json(left),
        "rightChecksum": sha256_prefixed_json(right),
        "sameChecksum": sha256_prefixed_json(left) == sha256_prefixed_json(right),
        "changedCounts": changed_counts,
        "datasetIdChanged": left["manifest"]["datasetId"] != right["manifest"]["datasetId"],
        "datasetVersionChanged": left["manifest"]["datasetVersion"] != right["manifest"]["datasetVersion"],
    }


def diff_to_markdown(diff: dict[str, Any]) -> str:
    lines = [
        "# Railway3D Dataset Diff",
        "",
        f"- Left: `{diff['left']}`",
        f"- Right: `{diff['right']}`",
        f"- Left checksum: `{diff['leftChecksum']}`",
        f"- Right checksum: `{diff['rightChecksum']}`",
        f"- Same checksum: `{str(diff['sameChecksum']).lower()}`",
        f"- Dataset ID changed: `{str(diff['datasetIdChanged']).lower()}`",
        f"- Dataset version changed: `{str(diff['datasetVersionChanged']).lower()}`",
        "",
        "## Entity Counts",
    ]
    changed_counts = diff["changedCounts"]
    if not changed_counts:
        lines.append("- No count changes.")
    else:
        for key, value in changed_counts.items():
            lines.append(f"- {key}: {value['from']} -> {value['to']}")
    return "\n".join(lines) + "\n"


def entity_counts(dataset: dict[str, Any]) -> dict[str, int]:
    return {
        "operators": len(dataset["operators"]),
        "lines": len(dataset["lines"]),
        "routes": len(dataset["routes"]),
        "alignments": len(dataset["alignments"]),
        "segments": len(dataset["segments"]),
        "stations": len(dataset["stations"]),
        "profiles": len(dataset["profiles"]),
        "controlPoints": len(dataset["controlPoints"]),
        "sources": len(dataset["sources"]),
    }

