from __future__ import annotations

from pathlib import Path

from railway3d_pipeline.cli import main
from railway3d_pipeline.source_audit import load_tokyo_metro_source_audit, source_audit_to_markdown
from railway3d_pipeline.source_registry import audit_source, fetch_source


def test_tokyo_metro_source_audit_has_required_sections() -> None:
    audit = load_tokyo_metro_source_audit()

    assert audit["regionId"] == "jp-tokyo-metro"
    assert audit["sourceCount"] == 4
    assert {source["adapter"] for source in audit["sources"]} == {
        "n02",
        "osm-pbf",
        "gsi-dem",
        "manual-control-points",
    }
    assert "Do not publish a Tokyo Metro dataset package" in audit["publicRedistributionDecision"]
    assert audit["candidatePilotCorridors"][0]["id"] == "jp-tokyo-metro-ginza-ueno-asakusa"
    assert audit["candidatePilotCorridors"][0]["status"] == "selected-geometry-inventory-pilot"
    assert audit["pilotCorridorPlanPath"] == "data/regions/jp/tokyo-metro-pilot-corridor.json"


def test_tokyo_metro_source_audit_markdown_contains_mandatory_items() -> None:
    markdown = source_audit_to_markdown(audit_source("jp-tokyo-metro"))

    assert "# Tokyo Metro Source Audit" in markdown
    assert "## Sources" in markdown
    assert "## Conflicts" in markdown
    assert "## Candidate Pilot Corridors" in markdown
    assert "## Unresolved Questions" in markdown
    assert "OSM layer" in markdown
    assert "No Tokyo Metro public dataset assets are generated in PR-010" in markdown
    assert "PR-015 Decision" in markdown
    assert "jp-tokyo-metro-ginza-ueno-asakusa" in markdown


def test_tokyo_metro_source_audit_cli_writes_markdown(tmp_path: Path) -> None:
    output = tmp_path / "tokyo-metro-source-audit.md"

    result = main(["source", "audit", "jp-tokyo-metro", "--output", str(output)])

    assert result == 0
    assert output.read_text(encoding="utf-8").startswith("# Tokyo Metro Source Audit")


def test_tokyo_metro_source_fetch_writes_corridor_plan_only(tmp_path: Path) -> None:
    report = fetch_source("jp-tokyo-metro", tmp_path)

    assert report["kind"] == "corridor-plan-only"
    assert report["corridorId"] == "jp-tokyo-metro-ginza-ueno-asakusa"
    assert (tmp_path / "pilot-corridor-plan.json").is_file()
    assert (tmp_path / "source-fetch-report.json").is_file()
