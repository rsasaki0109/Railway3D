export type EntityId = `r3d:${string}`;

export type StructureType =
  | 'underground_tunnel'
  | 'cut_and_cover_tunnel'
  | 'mountain_tunnel'
  | 'undersea_tunnel'
  | 'station_box'
  | 'surface'
  | 'cutting'
  | 'embankment'
  | 'viaduct'
  | 'bridge'
  | 'at_grade_crossing'
  | 'depot'
  | 'unknown';

export type ConfidenceLevel = 'unknown' | 'low' | 'medium' | 'high' | 'verified';

export type ColorMode = 'line' | 'structure' | 'clearance' | 'gradient' | 'confidence';
export type XRayMode = 'off' | 'selected' | 'all-underground';
export type VerticalExaggeration = 1 | 2 | 3 | 5;

export type Selection =
  | { kind: 'line'; id: EntityId }
  | { kind: 'station'; id: EntityId }
  | { kind: 'segment'; id: EntityId; chainageM?: number }
  | null;

export interface VisualizationState {
  colorMode: ColorMode;
  xrayMode: XRayMode;
  verticalExaggeration: VerticalExaggeration;
  stationVisible: boolean;
  labelVisible: boolean;
  guideVisible: boolean;
  uncertaintyVisible: boolean;
}

export interface ProfileCursor {
  segmentId: EntityId;
  position: readonly [number, number, number];
  groundPosition: readonly [number, number, number];
}

export type Position3D = [longitude: number, latitude: number, elevationM: number];

export type ExaggeratedPositions = Readonly<Record<VerticalExaggeration, Position3D[]>>;

export interface RenderPath {
  id: EntityId;
  lineIds: readonly EntityId[];
  segmentId: EntityId;
  positionsByExaggeration: ExaggeratedPositions;
  structure: StructureType;
  meanClearanceM: number | null;
  maxAbsGradientPermille: number | null;
  confidence: ConfidenceLevel;
  lineColor: readonly [number, number, number];
}

export interface RenderStation {
  id: EntityId;
  lineIds: readonly EntityId[];
  name: string;
  positionByExaggeration: Readonly<Record<VerticalExaggeration, Position3D>>;
  confidence: ConfidenceLevel;
}

export interface RenderGuide {
  id: EntityId;
  segmentId: EntityId;
  pathByExaggeration: ExaggeratedPositions;
}

export interface RenderDataset {
  id: string;
  paths: readonly RenderPath[];
  stations: readonly RenderStation[];
  guides: readonly RenderGuide[];
  profileCursorByExaggeration: Readonly<Record<VerticalExaggeration, ProfileCursor>>;
}

export interface LayerBuildContext {
  dataset: RenderDataset;
  visualization: VisualizationState;
  selection: Selection;
  hovered: Selection;
  profileCursor: ProfileCursor | null;
  callbacks: {
    onHover(selection: Selection): void;
    onSelect(selection: Selection): void;
  };
}
