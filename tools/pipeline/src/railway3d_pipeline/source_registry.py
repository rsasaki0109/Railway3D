from __future__ import annotations

from pathlib import Path
from typing import Any

from railway3d_pipeline.json_utils import read_json, sha256_hex, write_json
from railway3d_pipeline.source_audit import load_tokyo_metro_source_audit
from railway3d_pipeline.synthetic import SYNTHETIC_DATASET_PATH, SYNTHETIC_REGION_ID, PipelineError


def audit_source(region_id: str) -> dict[str, Any]:
    if region_id == "jp-tokyo-metro":
        return load_tokyo_metro_source_audit()

    dataset = load_synthetic_dataset(region_id)
    return {
        "regionId": region_id,
        "datasetId": dataset["manifest"]["datasetId"],
        "sourceCount": len(dataset["sources"]),
        "sources": [
            {
                "id": source["id"],
                "title": source["title"],
                "licenseId": source["license"]["id"],
                "redistributionAllowed": source["license"]["redistributionAllowed"],
                "citationText": source["citationText"],
            }
            for source in dataset["sources"]
        ],
        "publicRedistributionDecision": "allowed",
        "unresolvedQuestions": [],
    }


def fetch_source(region_id: str, output_dir: Path) -> dict[str, Any]:
    if region_id == "jp-tokyo-metro":
        raise PipelineError(
            "SOURCE_FETCH_NOT_IMPLEMENTED",
            "PR-010 audits Tokyo Metro sources but does not fetch or publish raw source snapshots.",
        )

    dataset = load_synthetic_dataset(region_id)
    output_dir.mkdir(parents=True, exist_ok=True)
    fixture_bytes = SYNTHETIC_DATASET_PATH.read_bytes()
    snapshot_path = output_dir / "synthetic-golden-source-snapshot.json"
    snapshot_path.write_bytes(fixture_bytes)
    manifest = {
        "regionId": region_id,
        "snapshot": snapshot_path.name,
        "checksum": f"sha256:{sha256_hex(fixture_bytes)}",
        "sourceIds": [source["id"] for source in dataset["sources"]],
    }
    write_json(output_dir / "source-fetch-report.json", manifest)
    return manifest


def load_synthetic_dataset(region_id: str) -> dict[str, Any]:
    if region_id != SYNTHETIC_REGION_ID:
        raise PipelineError("UNKNOWN_REGION", f"Only {SYNTHETIC_REGION_ID!r} is supported in PR-009.")
    dataset = read_json(SYNTHETIC_DATASET_PATH)
    if not isinstance(dataset, dict):
        raise PipelineError("DATASET_INVALID", "Synthetic dataset root is not an object.")
    return dataset
