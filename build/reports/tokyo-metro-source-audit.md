# Tokyo Metro Source Audit

- Region: `jp-tokyo-metro`
- Audit date: `2026-06-23`
- Scope: PR-010 source audit only. No real railway geometry, elevation values, or public data package are generated.
- Public redistribution decision: Do not publish a Tokyo Metro dataset package in PR-010. Publish only this audit report. Raw N02/OSM/GSI snapshots and operator documents are not included.

## Sources

### 国土数値情報 鉄道データ N02

- Source ID: `n02-railway-2025`
- Adapter: `n02` (audit-only)
- Version: 2025年度（令和7年度）版
- Retrieved at: 2026-06-23
- Publisher: 国土交通省 国土数値情報
- Source URL: https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html
- License: CC-BY-4.0 - Creative Commons Attribution 4.0 International
- Attribution required: yes
- Redistribution allowed: yes
- Horizontal CRS: JGD2011 / (B, L)
- Vertical datum: UNKNOWN
- Role: Line, station, and operator inventory candidate. Not a rail elevation source.
- Line/station coverage: Source page states national passenger railway and tram route/station coverage; Tokyo Metro extraction has not been run in PR-010.
- Structure coverage: No trusted tunnel, bridge, viaduct, or underground structure coverage for Railway3D Z modeling.
- Elevation control coverage: None.
- Prohibited use: Do not use N02 as rail elevation or surveyed centerline precision.
- Notes:
  - Use as canonical inventory candidate only.
  - Do not treat N02 geometry as surveyed railway centerline precision.
  - Do not derive rail elevation from this source.

### OpenStreetMap PBF extract for Kanto

- Source ID: `osm-kanto-pbf-planned`
- Adapter: `osm-pbf` (audit-only)
- Version: Snapshot not selected in PR-010
- Retrieved at: not-fetched
- Publisher: OpenStreetMap contributors
- Source URL: https://www.openstreetmap.org/copyright
- License: ODbL-1.0 - Open Database License 1.0
- Attribution required: yes
- Redistribution allowed: yes
- Horizontal CRS: EPSG:4326
- Vertical datum: UNKNOWN
- Role: Detailed alignment and structure tag candidate after snapshot selection and conflation.
- Line/station coverage: Not audited for Tokyo Metro in PR-010.
- Structure coverage: Potential tunnel/bridge/covered tags only; tag coverage and conflicts are unaudited.
- Elevation control coverage: None. OSM layer/tunnel/bridge tags are not Z values.
- Prohibited use: Do not convert OSM layer or structure tags into metric Z.
- Notes:
  - Do not convert OSM layer=* to meters.
  - Keep ODbL-derived outputs license-separated until legal/data policy review.

### 基盤地図情報 数値標高モデル

- Source ID: `gsi-dem-planned`
- Adapter: `gsi-dem` (audit-only)
- Version: Exact DEM mesh product not selected in PR-010
- Retrieved at: not-fetched
- Publisher: 国土地理院
- Source URL: https://service.gsi.go.jp/kiban/
- License: GSI-CONTENT-TERMS-PDL-1.0 - 国土地理院コンテンツ利用規約 / 公共データ利用規約 1.0
- Attribution required: yes
- Redistribution allowed: unknown
- Horizontal CRS: JGD2024 for DEM files provided on or after 2025-07-31; exact CRS must be read from metadata.
- Vertical datum: JGD2024_ORTHOMETRIC expected for post-2025-07-31 DEM after metadata confirmation
- Role: Ground elevation and terrain rendering source after exact mesh product selection.
- Line/station coverage: Not applicable.
- Structure coverage: None.
- Elevation control coverage: Ground elevation only; not rail elevation.
- Prohibited use: Do not use ground DEM as rail elevation control.
- Notes:
  - Do not mix pre-revision and post-revision DEM without explicit datum handling.
  - DEM grid spacing is not rail elevation accuracy.
  - No DEM snapshot is included in PR-010.

### Manual elevation control point registry

- Source ID: `manual-control-points-planned`
- Adapter: `manual-control-points` (audit-only)
- Version: Schema only; no Tokyo Metro values in PR-010
- Retrieved at: not-applicable
- Publisher: Railway3D contributors
- Source URL: data/regions/jp/tokyo-metro-source-audit.json
- License: TBD - Contribution terms not finalized
- Attribution required: yes
- Redistribution allowed: unknown
- Horizontal CRS: Depends on submitted control point definition
- Vertical datum: Must be explicit per value; UNKNOWN values cannot be used for clearance/depth calculation.
- Role: Future Q3/Q4 rail elevation, relative depth, portal, and grade-break controls after review.
- Line/station coverage: None in PR-010.
- Structure coverage: Potential reviewed portal and structure boundary controls after review.
- Elevation control coverage: None in PR-010.
- Prohibited use: Do not publish values without source license, datum, target, definition, and provenance.
- Notes:
  - No operator-document values are extracted in PR-010.
  - Relative depth controls require target, reference ground point, definition, provenance, and uncertainty.

## Conflicts
- N02 and OSM roles must remain separated: N02 for inventory, OSM for candidate detailed alignment after conflation.
- OSM layer, tunnel, bridge, and covered tags are structure hints, not rail elevation values.
- GSI DEM supplies ground elevation only; it cannot validate rail elevation without control points.
- No operator-published elevation source has been approved for public redistribution in PR-010.

## Candidate Pilot Corridors
- Not selected in PR-010: Pilot corridor selection requires verified rail elevation/control-point coverage and redistribution permission. This audit did not approve such a source.

## Unresolved Questions
- Which exact GSI DEM mesh product and retrieval snapshot will be used for Tokyo Metro ground profile?
- Which OSM PBF extract provider and snapshot date will be fixed, and how will ODbL-derived outputs be separated?
- Which Tokyo Metro pilot corridor has publicly reusable rail elevation or relative-depth controls?
- Can any operator-published station depth or longitudinal profile values be redistributed as derived numeric data?
- What manual review sign-off format is required before Q3/Q4 controls are accepted?
- How will N02 and OSM conflation conflicts be reviewed without copying source roles into each other?

## PR-010 Decision

No Tokyo Metro public dataset assets are generated in PR-010. The next milestone must choose fixed snapshots and approved control-point sources before any real geometry or elevation values are packaged.
