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

Current scope:

- Deterministic synthetic fixture build and checksum report.
- JSON Schema plus semantic dataset validation.
- Hard control point validation through the shared validator.
- Explicit failure when gradient constraints are infeasible.
- Explicit rejection when `UNKNOWN` vertical datum is used for clearance/depth-ready values.
- Public package guard for non-redistributable used sources.

Known limitations:

- Source audit/fetch supports only `synthetic-golden`.
- No N02, OSM, GSI DEM, or operator-document adapters are implemented in PR-009.
- The profile solver is still represented by the synthetic fixture and validation checks; full constrained solving begins after this foundation.
