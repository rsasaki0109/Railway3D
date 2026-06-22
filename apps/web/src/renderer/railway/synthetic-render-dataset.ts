import { toRenderElevation, VERTICAL_EXAGGERATIONS } from './elevation';
import type {
  EntityId,
  ExaggeratedPositions,
  Position3D,
  RenderDataset,
  RenderGuide,
  RenderPath,
  RenderStation,
  StructureType,
  VerticalExaggeration,
} from './render-types';

export const SYNTHETIC_LINE_ID = 'r3d:zz:synthetic:line:golden' as EntityId;
export const SYNTHETIC_DATASET_ID = 'synthetic-render-fixture';

interface PathFixture {
  id: EntityId;
  segmentId: EntityId;
  coordinates: readonly [number, number, number][];
  structure: StructureType;
  meanClearanceM: number | null;
  maxAbsGradientPermille: number | null;
  confidence: RenderPath['confidence'];
}

interface StationFixture {
  id: EntityId;
  name: string;
  position: Position3D;
  confidence: RenderStation['confidence'];
}

function buildPositionsByExaggeration(positions: readonly Position3D[]): ExaggeratedPositions {
  const exaggerated: Record<VerticalExaggeration, Position3D[]> = {
    1: [],
    2: [],
    3: [],
    5: [],
  };

  for (const exaggeration of VERTICAL_EXAGGERATIONS) {
    exaggerated[exaggeration] = positions.map(([longitude, latitude, elevation]) => [
      longitude,
      latitude,
      toRenderElevation(elevation, exaggeration),
    ]);
  }

  return exaggerated;
}

function buildPositionByExaggeration(
  position: Position3D,
): Record<VerticalExaggeration, Position3D> {
  return {
    1: [position[0], position[1], toRenderElevation(position[2], 1)],
    2: [position[0], position[1], toRenderElevation(position[2], 2)],
    3: [position[0], position[1], toRenderElevation(position[2], 3)],
    5: [position[0], position[1], toRenderElevation(position[2], 5)],
  };
}

const pathFixtures: readonly PathFixture[] = [
  {
    id: 'r3d:zz:synthetic:render-path:s01-underground',
    segmentId: 'r3d:zz:synthetic:segment:s01-underground',
    coordinates: [
      [139.61, 35.72, -18],
      [139.66, 35.705, -8],
      [139.71, 35.692, 2],
    ],
    structure: 'underground_tunnel',
    meanClearanceM: -16,
    maxAbsGradientPermille: 28.6,
    confidence: 'verified',
  },
  {
    id: 'r3d:zz:synthetic:render-path:s02-surface',
    segmentId: 'r3d:zz:synthetic:segment:s02-surface',
    coordinates: [
      [139.71, 35.692, 2],
      [139.745, 35.686, 4],
      [139.78, 35.68, 5],
    ],
    structure: 'surface',
    meanClearanceM: 0.5,
    maxAbsGradientPermille: 6,
    confidence: 'low',
  },
  {
    id: 'r3d:zz:synthetic:render-path:s03-viaduct',
    segmentId: 'r3d:zz:synthetic:segment:s03-viaduct',
    coordinates: [
      [139.78, 35.68, 5],
      [139.83, 35.675, 14],
      [139.87, 35.668, 18],
    ],
    structure: 'viaduct',
    meanClearanceM: 8,
    maxAbsGradientPermille: 16.3,
    confidence: 'medium',
  },
  {
    id: 'r3d:zz:synthetic:render-path:s04-bridge',
    segmentId: 'r3d:zz:synthetic:segment:s04-bridge',
    coordinates: [
      [139.87, 35.668, 18],
      [139.895, 35.663, 21],
      [139.92, 35.656, 22],
    ],
    structure: 'bridge',
    meanClearanceM: 21,
    maxAbsGradientPermille: 10,
    confidence: 'high',
  },
  {
    id: 'r3d:zz:synthetic:render-path:s06-branch-b',
    segmentId: 'r3d:zz:synthetic:segment:s06-branch-b',
    coordinates: [
      [139.71, 35.692, 2],
      [139.708, 35.646, 4],
      [139.705, 35.604, 6],
    ],
    structure: 'surface',
    meanClearanceM: 0,
    maxAbsGradientPermille: null,
    confidence: 'low',
  },
];

const stationFixtures: readonly StationFixture[] = [
  {
    id: 'r3d:zz:synthetic:station:A',
    name: 'Station A',
    position: [139.61, 35.72, -18],
    confidence: 'verified',
  },
  {
    id: 'r3d:zz:synthetic:station:C',
    name: 'Station C',
    position: [139.92, 35.656, 28],
    confidence: 'verified',
  },
];

const verticalGuideBase: readonly Position3D[] = [
  [139.66, 35.705, -8],
  [139.66, 35.705, 8],
];

const profileCursorBase: Position3D = [139.71, 35.692, 2];
const profileCursorGroundBase: Position3D = [139.71, 35.692, 42];

const guides: readonly RenderGuide[] = [
  {
    id: 'r3d:zz:synthetic:guide:underground-clearance',
    segmentId: 'r3d:zz:synthetic:segment:s01-underground',
    pathByExaggeration: buildPositionsByExaggeration(verticalGuideBase),
  },
];

export const syntheticRenderDataset: RenderDataset = {
  id: SYNTHETIC_DATASET_ID,
  paths: pathFixtures.map((path) => ({
    id: path.id,
    lineIds: [SYNTHETIC_LINE_ID],
    segmentId: path.segmentId,
    positionsByExaggeration: buildPositionsByExaggeration(path.coordinates),
    structure: path.structure,
    meanClearanceM: path.meanClearanceM,
    maxAbsGradientPermille: path.maxAbsGradientPermille,
    confidence: path.confidence,
    lineColor: [47, 111, 115],
  })),
  stations: stationFixtures.map((station) => ({
    id: station.id,
    lineIds: [SYNTHETIC_LINE_ID],
    name: station.name,
    positionByExaggeration: buildPositionByExaggeration(station.position),
    confidence: station.confidence,
  })),
  guides,
  profileCursorByExaggeration: {
    1: {
      segmentId: 'r3d:zz:synthetic:segment:s02-surface',
      position: [
        profileCursorBase[0],
        profileCursorBase[1],
        toRenderElevation(profileCursorBase[2], 1),
      ],
      groundPosition: [
        profileCursorGroundBase[0],
        profileCursorGroundBase[1],
        toRenderElevation(profileCursorGroundBase[2], 1),
      ],
    },
    2: {
      segmentId: 'r3d:zz:synthetic:segment:s02-surface',
      position: [
        profileCursorBase[0],
        profileCursorBase[1],
        toRenderElevation(profileCursorBase[2], 2),
      ],
      groundPosition: [
        profileCursorGroundBase[0],
        profileCursorGroundBase[1],
        toRenderElevation(profileCursorGroundBase[2], 2),
      ],
    },
    3: {
      segmentId: 'r3d:zz:synthetic:segment:s02-surface',
      position: [
        profileCursorBase[0],
        profileCursorBase[1],
        toRenderElevation(profileCursorBase[2], 3),
      ],
      groundPosition: [
        profileCursorGroundBase[0],
        profileCursorGroundBase[1],
        toRenderElevation(profileCursorGroundBase[2], 3),
      ],
    },
    5: {
      segmentId: 'r3d:zz:synthetic:segment:s02-surface',
      position: [
        profileCursorBase[0],
        profileCursorBase[1],
        toRenderElevation(profileCursorBase[2], 5),
      ],
      groundPosition: [
        profileCursorGroundBase[0],
        profileCursorGroundBase[1],
        toRenderElevation(profileCursorGroundBase[2], 5),
      ],
    },
  },
};
