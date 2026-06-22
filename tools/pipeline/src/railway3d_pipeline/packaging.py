from __future__ import annotations

from pathlib import Path
from typing import Any

from railway3d_pipeline.json_utils import read_json, sha256_hex, sha256_prefixed_json, write_json
from railway3d_pipeline.synthetic import PipelineError


def package_dataset(dataset_path: Path, target_dir: Path, *, public: bool) -> dict[str, Any]:
    dataset = read_json(dataset_path)
    if public:
        assert_public_redistribution_allowed(dataset)

    target_dir.mkdir(parents=True, exist_ok=True)
    packaged_dataset_path = target_dir / "dataset.json"
    source_bytes = dataset_path.read_bytes()
    packaged_dataset_path.write_bytes(source_bytes)

    used_sources = collect_used_sources(dataset)
    source_by_id = {source["id"]: source for source in dataset["sources"]}
    included_sources = [source_by_id[source_id] for source_id in sorted(used_sources) if source_id in source_by_id]
    licenses = [
        {
            "sourceId": source["id"],
            "license": source["license"],
            "citationText": source["citationText"],
        }
        for source in included_sources
    ]
    attribution = "\n".join(f"- {source['citationText']}" for source in included_sources) + "\n"

    write_json(target_dir / "licenses.json", {"sources": licenses})
    (target_dir / "ATTRIBUTION.md").write_text("# Attribution\n\n" + attribution, encoding="utf-8")

    dataset_checksum = f"sha256:{sha256_hex(source_bytes)}"
    package_manifest = {
        "datasetId": dataset["manifest"]["datasetId"],
        "datasetVersion": dataset["manifest"]["datasetVersion"],
        "datasetChecksum": dataset_checksum,
        "canonicalDatasetChecksum": sha256_prefixed_json(dataset),
        "public": public,
        "usedSourceIds": sorted(used_sources),
    }
    write_json(target_dir / "package-manifest.json", package_manifest)
    (target_dir / "checksums.sha256").write_text(
        f"{dataset_checksum.removeprefix('sha256:')}  dataset.json\n",
        encoding="utf-8",
    )
    return package_manifest


def assert_public_redistribution_allowed(dataset: dict[str, Any]) -> None:
    used_sources = collect_used_sources(dataset)
    source_by_id = {source["id"]: source for source in dataset["sources"]}
    blocked = [
        source_id
        for source_id in sorted(used_sources)
        if source_by_id.get(source_id, {}).get("license", {}).get("redistributionAllowed") is not True
    ]
    if blocked:
        raise PipelineError(
            "NON_REDISTRIBUTABLE_SOURCE",
            f"Public package includes sources without redistribution permission: {', '.join(blocked)}.",
        )


def collect_used_sources(value: Any) -> set[str]:
    used: set[str] = set()
    visit_for_sources(value, used)
    return used


def visit_for_sources(value: Any, used: set[str]) -> None:
    if isinstance(value, dict):
        source_id = value.get("sourceId")
        if isinstance(source_id, str):
            used.add(source_id)
        for child in value.values():
            visit_for_sources(child, used)
    elif isinstance(value, list):
        for child in value:
            visit_for_sources(child, used)

