from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SourceAdapterSpec:
    id: str
    label: str
    status: str
    required_fields: tuple[str, ...]
    prohibited_use: str


SUPPORTED_SOURCE_ADAPTERS: dict[str, SourceAdapterSpec] = {
    "n02": SourceAdapterSpec(
        id="n02",
        label="National Land Numerical Information railway adapter",
        status="audit-only",
        required_fields=("sourceUrl", "version", "horizontalCrs", "license"),
        prohibited_use="Do not use N02 as rail elevation or surveyed centerline precision.",
    ),
    "osm-pbf": SourceAdapterSpec(
        id="osm-pbf",
        label="OpenStreetMap PBF adapter",
        status="audit-only",
        required_fields=("sourceUrl", "version", "horizontalCrs", "license"),
        prohibited_use="Do not convert OSM layer or structure tags into metric Z.",
    ),
    "gsi-dem": SourceAdapterSpec(
        id="gsi-dem",
        label="GSI DEM adapter",
        status="audit-only",
        required_fields=("sourceUrl", "version", "horizontalCrs", "verticalDatum", "license"),
        prohibited_use="Do not use ground DEM as rail elevation control.",
    ),
    "manual-control-points": SourceAdapterSpec(
        id="manual-control-points",
        label="Manual control point adapter",
        status="audit-only",
        required_fields=("version", "verticalDatum", "license"),
        prohibited_use="Do not publish values without source license, datum, target, definition, and provenance.",
    ),
}


def validate_adapter_sources(sources: list[dict[str, Any]]) -> list[str]:
    issues: list[str] = []
    for index, source in enumerate(sources):
        adapter_id = source.get("adapter")
        if not isinstance(adapter_id, str) or adapter_id not in SUPPORTED_SOURCE_ADAPTERS:
            issues.append(f"sources/{index}: unsupported adapter {adapter_id!r}")
            continue
        adapter = SUPPORTED_SOURCE_ADAPTERS[adapter_id]
        for field in adapter.required_fields:
            if field not in source:
                issues.append(f"sources/{index}: adapter {adapter_id!r} requires field {field!r}")
    return issues


def adapter_summary(adapter_id: str) -> dict[str, str]:
    adapter = SUPPORTED_SOURCE_ADAPTERS[adapter_id]
    return {
        "id": adapter.id,
        "label": adapter.label,
        "status": adapter.status,
        "prohibitedUse": adapter.prohibited_use,
    }
