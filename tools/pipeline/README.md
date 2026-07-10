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

PR-012 promotes the `n02` (国土数値情報 鉄道データ N02) adapter from an audit-only skeleton to a
real, deterministic parser for N02-shaped railway inventory documents:

```bash
uv run --project tools/pipeline railway3d source parse-n02 data/sample/n02/v1/example-n02-inventory.json --output build/reports/example-n02-inventory.json
uv run --project tools/pipeline railway3d source parse-n02 data/sample/n02/v1/example-n02-inventory.json --output build/reports/example-n02-inventory.md
```

This command parses an N02-shaped `FeatureCollection`-like document (`RailroadSection` and
`Station` features carrying `N02_002`/`N02_003`/`N02_004`/`N02_005` properties), structurally
validates it in Python (no separate JSON Schema file for the document itself), and normalizes it
into operator/line/station inventory candidates that conform to `schemas/v1/operator.schema.json`,
`schemas/v1/line.schema.json`, and `schemas/v1/station.schema.json`. Operators are deduped by
運営会社 (`N02_004`) and lines by (`N02_004`, `N02_003`) across all features; entity ids are
derived deterministically from a sha256 hash of the source Japanese names, since the shared
`entityId` pattern only allows ASCII slug characters. The license's `redistributionAllowed` flag
drives an explicit `publicRedistributionDecision` in the report, mirroring PR-011.

N02 is a line/station/operator **inventory candidate only** source, not a rail elevation source:
the adapter never emits a station `groundReference`, never emits a non-empty station `levels[]`
elevation, and never emits `railElevation` anywhere. Every normalized station always has
`"levels": []` and no `groundReference` field.

PR-012 limitations:

- Only the bundled synthetic, N02-shaped example fixture is parsed; there is no real fetch from
  the 国土数値情報 (National Land Numerical Information) N02 dataset.
- `data/sample/n02/v1/example-n02-inventory.json` is a synthetic example (`"synthetic": true`)
  with fictional operator/line/station names; it is not derived from any real N02 release.
- This adapter is inventory-only: it does not attempt surveyed centerline precision or any
  elevation/Z value.

PR-013 promotes the `osm-pbf` adapter from an audit-only skeleton to a real, deterministic
parser for OSM-shaped railway extract documents (JSON fixtures; not binary `.osm.pbf` bytes):

```bash
uv run --project tools/pipeline railway3d source parse-osm data/sample/osm/v1/example-osm-railway-extract.json --output build/reports/example-osm-railway-extract.json
uv run --project tools/pipeline railway3d source parse-osm data/sample/osm/v1/example-osm-railway-extract.json --output build/reports/example-osm-railway-extract.md
```

The adapter normalizes railway ways into alignments/segments (structure tags only) and stations
into inventory points. Profiles are elevation-null stubs with `MISSING_RAIL_ELEVATION`. Tags such
as `ele`, `height`, or 3D coordinates are rejected (`OSM_ELEVATION_PROHIBITED`). `layer` is never
converted to meters.

PR-013 limitations:

- Only the bundled synthetic OSM-shaped fixture is parsed; no real PBF fetch or provider snapshot.
- ODbL license separation for derived public packages remains a later legal/data-policy step.

PR-014 promotes the `gsi-dem` adapter to a deterministic ground-elevation grid parser:

```bash
uv run --project tools/pipeline railway3d source parse-gsi-dem data/sample/gsi-dem/v1/example-gsi-dem-grid.json --output build/reports/example-gsi-dem-grid.json
uv run --project tools/pipeline railway3d source parse-gsi-dem data/sample/gsi-dem/v1/example-gsi-dem-grid.json --output build/reports/example-gsi-dem-grid.md
```

Samples are ground elevation only (`railElevationM` is always null). Role must be
`ground_elevation` or `terrain_rendering`. `UNKNOWN` vertical datum is rejected
(`GSI_DEM_DATUM_UNKNOWN`). Void cells are preserved with `DEM_VOID`.

PR-014 limitations:

- Only the bundled synthetic DEM-shaped grid is parsed; no real 基盤地図情報 DEM product is fetched.
- DEM cannot validate or supply rail elevation.

PR-015 selects a Tokyo Metro geometry/inventory pilot corridor and freezes a plan package:

```bash
uv run --project tools/pipeline railway3d source plan-corridor jp-tokyo-metro --output build/plans/jp-tokyo-metro
uv run --project tools/pipeline railway3d source fetch jp-tokyo-metro --output build/sources/jp-tokyo-metro
uv run --project tools/pipeline railway3d source audit jp-tokyo-metro --output build/reports/tokyo-metro-source-audit.md
```

Selected corridor: **銀座線 上野–浅草** (`jp-tokyo-metro-ginza-ueno-asakusa`), status
`geometry-inventory-pilot`. Public package decision remains **blocked**. `source fetch` for
`jp-tokyo-metro` writes the corridor plan only; it does not download N02/OSM/GSI bytes.

PR-015 limitations:

- No real Tokyo Metro geometry, DEM, or elevation package is published.
- Manual control points for the corridor remain unapproved for public redistribution.
- Real snapshot pinning (exact N02/OSM/GSI bytes) remains an unresolved gate.
