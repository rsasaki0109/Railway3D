from __future__ import annotations

from pathlib import Path
from typing import Any

from railway3d_pipeline.json_utils import read_json
from railway3d_pipeline.source_adapters import adapter_summary, validate_adapter_sources
from railway3d_pipeline.synthetic import PipelineError


TOKYO_METRO_AUDIT_CONFIG = Path("data/regions/jp/tokyo-metro-source-audit.json")


def load_tokyo_metro_source_audit(config_path: Path = TOKYO_METRO_AUDIT_CONFIG) -> dict[str, Any]:
    audit = read_json(config_path)
    if not isinstance(audit, dict):
        raise PipelineError("SOURCE_AUDIT_INVALID", "Tokyo Metro source audit config must be an object.")

    sources = audit.get("sources")
    if not isinstance(sources, list):
        raise PipelineError("SOURCE_AUDIT_INVALID", "Tokyo Metro source audit config requires sources[].")

    issues = validate_adapter_sources(sources)
    if issues:
        raise PipelineError("SOURCE_AUDIT_INVALID", "; ".join(issues))

    normalized_sources = []
    for source in sources:
        normalized_sources.append(
            {
                **source,
                "adapterSpec": adapter_summary(source["adapter"]),
            }
        )

    return {
        **audit,
        "sources": normalized_sources,
        "sourceCount": len(normalized_sources),
        "adapters": [adapter_summary(source["adapter"]) for source in sources],
    }


def source_audit_to_markdown(audit: dict[str, Any]) -> str:
    lines = [
        "# Tokyo Metro Source Audit",
        "",
        f"- Region: `{audit['regionId']}`",
        f"- Audit date: `{audit['auditDate']}`",
        f"- Scope: {audit['scope']}",
        f"- Public redistribution decision: {audit['publicRedistributionDecision']}",
        "",
        "## Sources",
    ]
    for source in audit["sources"]:
        license_info = source["license"]
        lines.extend(
            [
                "",
                f"### {source['name']}",
                "",
                f"- Source ID: `{source['id']}`",
                f"- Adapter: `{source['adapter']}` ({source['adapterSpec']['status']})",
                f"- Version: {source['version']}",
                f"- Retrieved at: {source['retrievedAt']}",
                f"- Publisher: {source['publisher']}",
                f"- Source URL: {source['sourceUrl']}",
                f"- License: {license_info['id']} - {license_info['name']}",
                f"- Attribution required: {format_boolish(license_info['attributionRequired'])}",
                f"- Redistribution allowed: {format_boolish(license_info['redistributionAllowed'])}",
                f"- Horizontal CRS: {source['horizontalCrs']}",
                f"- Vertical datum: {source['verticalDatum']}",
                f"- Role: {source['role']}",
                f"- Line/station coverage: {source['lineStationCoverage']}",
                f"- Structure coverage: {source['structureCoverage']}",
                f"- Elevation control coverage: {source['elevationControlCoverage']}",
                f"- Prohibited use: {source['adapterSpec']['prohibitedUse']}",
            ]
        )
        if source.get("notes"):
            lines.append("- Notes:")
            for note in source["notes"]:
                lines.append(f"  - {note}")

    lines.extend(["", "## Conflicts"])
    lines.extend(f"- {item}" for item in audit["conflicts"])

    lines.extend(["", "## Candidate Pilot Corridors"])
    for candidate in audit["candidatePilotCorridors"]:
        status = candidate.get("status")
        status_suffix = f" [{status}]" if status else ""
        corridor_id = candidate.get("id")
        id_prefix = f"`{corridor_id}` " if corridor_id else ""
        lines.append(f"- {id_prefix}{candidate['name']}{status_suffix}: {candidate['reason']}")

    lines.extend(["", "## Unresolved Questions"])
    lines.extend(f"- {item}" for item in audit["unresolvedQuestions"])

    lines.extend(
        [
            "",
            "## PR-010 Decision",
            "",
            "No Tokyo Metro public dataset assets are generated in PR-010. The next milestone must choose fixed snapshots and approved control-point sources before any real geometry or elevation values are packaged.",
            "",
            "## PR-015 Decision",
            "",
            "Pilot corridor `jp-tokyo-metro-ginza-ueno-asakusa` (銀座線 上野–浅草) is selected as a geometry/inventory pilot only. "
            "OSM and GSI DEM adapters can parse synthetic fixtures; real N02/OSM/GSI bytes are still not fetched. "
            "Public Tokyo Metro packages and rail elevation packaging remain blocked until approved control points and fixed real snapshots exist.",
        ]
    )
    if audit.get("pilotCorridorPlanPath"):
        lines.extend(["", f"Pilot corridor plan: `{audit['pilotCorridorPlanPath']}`", ""])
    else:
        lines.append("")
    return "\n".join(lines)


def format_boolish(value: object) -> str:
    if isinstance(value, bool):
        return "yes" if value else "no"
    return str(value)
