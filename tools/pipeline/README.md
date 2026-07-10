# Railway3D Pipeline

PR-009 provides the first reproducible pipeline foundation for the fully synthetic
golden fixture. It intentionally does not fetch or infer real railway data.

Supported commands in this milestone:

```bash
uv run --project tools/pipeline railway3d source audit synthetic-golden
uv run --project tools/pipeline railway3d source fetch synthetic-golden --output build/sources/synthetic-golden
uv run --project tools/pipeline railway3d build region synthetic-golden --output build/data/synthetic-golden
uv run --project tools/pipeline railway3d validate dataset build/data/synthetic-golden/dataset.json
uv run --project tools/pipeline railway3d diff dataset data/sample/synthetic-golden/v1/dataset.json build/data/synthetic-golden/dataset.json
uv run --project tools/pipeline railway3d package dataset build/data/synthetic-golden/dataset.json --target build/package/synthetic-golden --public
```

PR-010 adds an audit-only Tokyo Metro source configuration:

```bash
uv run --project tools/pipeline railway3d source audit jp-tokyo-metro --output build/reports/tokyo-metro-source-audit.md
```

Current scope:

- Deterministic synthetic fixture build and checksum report.
- JSON Schema plus semantic dataset validation.
- Hard control point validation through the shared validator.
- Explicit failure when gradient constraints are infeasible.
- Explicit rejection when `UNKNOWN` vertical datum is used for clearance/depth-ready values.
- Public package guard for non-redistributable used sources.

Known limitations:

- Synthetic build/fetch supports only `synthetic-golden`.
- No N02, OSM, GSI DEM, or operator-document adapters are implemented in PR-009.
- The profile solver is still represented by the synthetic fixture and validation checks; full constrained solving begins after this foundation.

PR-010 limitations:

- `jp-tokyo-metro` source audit is report-only.
- N02, OSM PBF, GSI DEM, and manual control point adapters are audit skeletons; they do not fetch, parse, conflate, or package real data.
- No Tokyo Metro pilot corridor is selected until rail elevation/control-point coverage and redistribution permission are verified.

PR-011 promotes the `manual-control-points` adapter from an audit-only skeleton to a real,
deterministic ingestion path for human-authored control point documents:

```bash
uv run --project tools/pipeline railway3d source ingest data/sample/manual-control-points/v1/example-control-points.json --output build/reports/example-control-points.json
uv run --project tools/pipeline railway3d source ingest data/sample/manual-control-points/v1/example-control-points.json --output build/reports/example-control-points.md
```

This command parses a manual control point authoring document, structurally validates it in
Python (no separate JSON Schema file for the document itself), and normalizes each point into a
`controlPoints[]` entry that conforms to `schemas/v1/control-point.schema.json`. Enforcement
mirrors the project's scope guard: a point that carries an elevation value (`rail_elevation`,
`platform_elevation`, `portal`, `grade_break`, `structure_boundary`) requires an explicit,
known vertical datum, a definition, a target, and a source citation; ingestion rejects the whole
document (`MANUAL_CONTROL_DATUM_UNKNOWN`) if the document's vertical datum is `UNKNOWN` while any
such point exists. Duplicate point ids and non-monotonic chainage per owner are also rejected.
The license's `redistributionAllowed` flag drives an explicit `publicRedistributionDecision` in
the report.

PR-011 limitations:

- Only manually authored control point documents are ingested; there is no automated fetch from
  N02, OSM, or GSI DEM.
- `data/sample/manual-control-points/v1/example-control-points.json` is a synthetic authoring
  example (`"synthetic": true`); it is not derived from any real Tokyo Metro survey.
- The N02, OSM PBF, and GSI DEM adapters remain audit-only skeletons; this PR only promotes
  `manual-control-points`.
