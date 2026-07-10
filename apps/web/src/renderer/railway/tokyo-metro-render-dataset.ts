import { toRenderElevation, VERTICAL_EXAGGERATIONS } from './elevation';
import type {
  EntityId,
  ExaggeratedPositions,
  Position3D,
  ProfileCursor,
  ProfileCursorSample,
  RenderDataset,
  RenderGuide,
  RenderPath,
  RenderStation,
  VerticalExaggeration,
} from './render-types';

/**
 * Tokyo Metro geometry/inventory pilot for GitHub Pages.
 *
 * Horizontal coordinates are approximate public station locations (WGS84) for
 * visualization only. Vertical values are illustrative underground depths, not
 * surveyed rail elevations, and must not be used for navigation or clearance design.
 */
export const TOKYO_METRO_DATASET_ID = 'tokyo-metro-pilot-render';
export const TOKYO_METRO_GINZA_LINE_ID = 'r3d:jp:tokyometro:line:ginza' as EntityId;
export const TOKYO_METRO_MARUNOUCHI_LINE_ID = 'r3d:jp:tokyometro:line:marunouchi' as EntityId;

const GINZA_COLOR: readonly [number, number, number] = [255, 149, 0];
const MARUNOUCHI_COLOR: readonly [number, number, number] = [246, 46, 54];

interface StationDef {
  id: EntityId;
  name: string;
  number: string;
  position: Position3D;
  lineIds: readonly EntityId[];
}

interface PathDef {
  id: EntityId;
  segmentId: EntityId;
  lineIds: readonly EntityId[];
  coordinates: readonly Position3D[];
  color: readonly [number, number, number];
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

/**
 * Illustrative rail elevations (m) chosen so depth is readable under vertical
 * exaggeration. Values are NOT surveyed Tokyo Metro rail elevations.
 * Ground is modeled near +12..+20 m; more negative rail = deeper underground.
 */
function withIllustrativeDepth(lng: number, lat: number, railElevationM: number): Position3D {
  return [lng, lat, railElevationM];
}

function groundElevationForIndex(index: number): number {
  return 14 + (index % 4) * 1.5;
}

// Approximate public station coordinates. Rail Z is illustrative only.
const ginzaStations: readonly StationDef[] = [
  {
    id: 'r3d:jp:tokyometro:station:ginza-asakusa',
    name: '浅草',
    number: 'G-19',
    position: withIllustrativeDepth(139.7967, 35.711, -8),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-tawaramachi',
    name: '田原町',
    number: 'G-18',
    position: withIllustrativeDepth(139.7907, 35.7098, -12),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-inaricho',
    name: '稲荷町',
    number: 'G-17',
    position: withIllustrativeDepth(139.7825, 35.7112, -16),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-ueno',
    name: '上野',
    number: 'G-16',
    position: withIllustrativeDepth(139.7774, 35.7105, -22),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-ueno-hirokoji',
    name: '上野広小路',
    number: 'G-15',
    position: withIllustrativeDepth(139.7732, 35.7077, -24),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-suehirocho',
    name: '末広町',
    number: 'G-14',
    position: withIllustrativeDepth(139.7716, 35.7028, -26),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-kanda',
    name: '神田',
    number: 'G-13',
    position: withIllustrativeDepth(139.7708, 35.6917, -28),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-mitsukoshimae',
    name: '三越前',
    number: 'G-12',
    position: withIllustrativeDepth(139.7726, 35.6851, -30),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-nihombashi',
    name: '日本橋',
    number: 'G-11',
    position: withIllustrativeDepth(139.7745, 35.682, -32),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-kyobashi',
    name: '京橋',
    number: 'G-10',
    position: withIllustrativeDepth(139.7697, 35.6767, -30),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-ginza',
    name: '銀座',
    number: 'G-09',
    position: withIllustrativeDepth(139.7671, 35.6717, -26),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID, TOKYO_METRO_MARUNOUCHI_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-shimbashi',
    name: '新橋',
    number: 'G-08',
    position: withIllustrativeDepth(139.758, 35.6664, -22),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-toranomon',
    name: '虎ノ門',
    number: 'G-07',
    position: withIllustrativeDepth(139.7495, 35.6701, -20),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-tameike-sanno',
    name: '溜池山王',
    number: 'G-06',
    position: withIllustrativeDepth(139.7414, 35.6727, -24),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-akasaka-mitsuke',
    name: '赤坂見附',
    number: 'G-05',
    position: withIllustrativeDepth(139.7366, 35.6769, -28),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID, TOKYO_METRO_MARUNOUCHI_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-aoyama-itchome',
    name: '青山一丁目',
    number: 'G-04',
    position: withIllustrativeDepth(139.7241, 35.6728, -24),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-gaiemmae',
    name: '外苑前',
    number: 'G-03',
    position: withIllustrativeDepth(139.7177, 35.6705, -20),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-omotesando',
    name: '表参道',
    number: 'G-02',
    position: withIllustrativeDepth(139.7123, 35.6652, -18),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:ginza-shibuya',
    name: '渋谷',
    number: 'G-01',
    position: withIllustrativeDepth(139.7013, 35.658, -34),
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
  },
];

const marunouchiStations: readonly StationDef[] = [
  {
    id: 'r3d:jp:tokyometro:station:marunouchi-ikebukuro',
    name: '池袋',
    number: 'M-25',
    position: withIllustrativeDepth(139.7109, 35.7295, -10),
    lineIds: [TOKYO_METRO_MARUNOUCHI_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:marunouchi-myogadani',
    name: '茗荷谷',
    number: 'M-23',
    position: withIllustrativeDepth(139.728, 35.7174, -18),
    lineIds: [TOKYO_METRO_MARUNOUCHI_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:marunouchi-korakuen',
    name: '後楽園',
    number: 'M-22',
    position: withIllustrativeDepth(139.7517, 35.7073, -26),
    lineIds: [TOKYO_METRO_MARUNOUCHI_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:marunouchi-ochanomizu',
    name: '御茶ノ水',
    number: 'M-20',
    position: withIllustrativeDepth(139.7637, 35.6995, -22),
    lineIds: [TOKYO_METRO_MARUNOUCHI_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:marunouchi-tokyo',
    name: '東京',
    number: 'M-17',
    position: withIllustrativeDepth(139.7671, 35.6812, -30),
    lineIds: [TOKYO_METRO_MARUNOUCHI_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:marunouchi-ginza',
    name: '銀座',
    number: 'M-16',
    position: withIllustrativeDepth(139.7671, 35.6717, -36),
    lineIds: [TOKYO_METRO_MARUNOUCHI_LINE_ID, TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:marunouchi-kasumigaseki',
    name: '霞ケ関',
    number: 'M-15',
    position: withIllustrativeDepth(139.7528, 35.6738, -32),
    lineIds: [TOKYO_METRO_MARUNOUCHI_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:marunouchi-akasaka-mitsuke',
    name: '赤坂見附',
    number: 'M-13',
    position: withIllustrativeDepth(139.7366, 35.6769, -28),
    lineIds: [TOKYO_METRO_MARUNOUCHI_LINE_ID, TOKYO_METRO_GINZA_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:marunouchi-yotsuya',
    name: '四ツ谷',
    number: 'M-12',
    position: withIllustrativeDepth(139.7303, 35.6861, -20),
    lineIds: [TOKYO_METRO_MARUNOUCHI_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:marunouchi-shinjuku',
    name: '新宿',
    number: 'M-08',
    position: withIllustrativeDepth(139.7003, 35.6896, -24),
    lineIds: [TOKYO_METRO_MARUNOUCHI_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:marunouchi-nakano-sakaue',
    name: '中野坂上',
    number: 'M-06',
    position: withIllustrativeDepth(139.6828, 35.697, -16),
    lineIds: [TOKYO_METRO_MARUNOUCHI_LINE_ID],
  },
  {
    id: 'r3d:jp:tokyometro:station:marunouchi-ogikubo',
    name: '荻窪',
    number: 'M-01',
    position: withIllustrativeDepth(139.6201, 35.7042, -10),
    lineIds: [TOKYO_METRO_MARUNOUCHI_LINE_ID],
  },
];

const pathDefs: readonly PathDef[] = [
  {
    id: 'r3d:jp:tokyometro:render-path:ginza',
    segmentId: 'r3d:jp:tokyometro:segment:ginza-main',
    lineIds: [TOKYO_METRO_GINZA_LINE_ID],
    coordinates: ginzaStations.map((station) => station.position),
    color: GINZA_COLOR,
  },
  {
    id: 'r3d:jp:tokyometro:render-path:marunouchi',
    segmentId: 'r3d:jp:tokyometro:segment:marunouchi-main',
    lineIds: [TOKYO_METRO_MARUNOUCHI_LINE_ID],
    coordinates: marunouchiStations.map((station) => station.position),
    color: MARUNOUCHI_COLOR,
  },
];

const allStations: readonly StationDef[] = [
  ...ginzaStations,
  ...marunouchiStations.filter(
    (station) => !ginzaStations.some((ginza) => ginza.name === station.name),
  ),
];

function buildDepthGuides(
  stations: readonly StationDef[],
  segmentId: EntityId,
  idPrefix: string,
): readonly RenderGuide[] {
  return stations.map((station, index) => {
    const groundZ = groundElevationForIndex(index);
    const railZ = station.position[2];
    return {
      id: `r3d:jp:tokyometro:guide:${idPrefix}-${station.number.toLowerCase()}` as EntityId,
      segmentId,
      pathByExaggeration: buildPositionsByExaggeration([
        [station.position[0], station.position[1], groundZ],
        [station.position[0], station.position[1], railZ],
      ]),
    };
  });
}

const guides: readonly RenderGuide[] = [
  ...buildDepthGuides(ginzaStations, 'r3d:jp:tokyometro:segment:ginza-main', 'ginza'),
  ...buildDepthGuides(
    marunouchiStations,
    'r3d:jp:tokyometro:segment:marunouchi-main',
    'marunouchi',
  ),
];

// Profile samples along Ginza Line Asakusa→Shibuya (illustrative Z only).
export const tokyoMetroProfileCursorSamples: readonly ProfileCursorSample[] = ginzaStations.map(
  (station, index) => ({
    chainageM: index * 800,
    segmentId: 'r3d:jp:tokyometro:segment:ginza-main',
    position: station.position,
    groundPosition: [station.position[0], station.position[1], groundElevationForIndex(index)],
    // Leave one mid-line sample unknown to exercise null rail gaps.
    railElevationKnown: station.number !== 'G-10',
  }),
);

function toProfileCursor(
  sample: ProfileCursorSample,
  exaggeration: VerticalExaggeration,
): ProfileCursor {
  return {
    segmentId: sample.segmentId,
    position: [
      sample.position[0],
      sample.position[1],
      toRenderElevation(sample.position[2], exaggeration),
    ],
    groundPosition: [
      sample.groundPosition[0],
      sample.groundPosition[1],
      toRenderElevation(sample.groundPosition[2], exaggeration),
    ],
  };
}

function interpolateNumber(from: number, to: number, ratio: number): number {
  return from + (to - from) * ratio;
}

function interpolatePosition(from: Position3D, to: Position3D, ratio: number): Position3D {
  return [
    interpolateNumber(from[0], to[0], ratio),
    interpolateNumber(from[1], to[1], ratio),
    interpolateNumber(from[2], to[2], ratio),
  ];
}

export function resolveTokyoMetroProfileCursor(
  chainageM: number | null,
  exaggeration: VerticalExaggeration,
): ProfileCursor | null {
  if (chainageM === null) {
    return null;
  }

  const first = tokyoMetroProfileCursorSamples[0];
  const last = tokyoMetroProfileCursorSamples[tokyoMetroProfileCursorSamples.length - 1];
  if (
    first === undefined ||
    last === undefined ||
    chainageM < first.chainageM ||
    chainageM > last.chainageM
  ) {
    return null;
  }

  const exact = tokyoMetroProfileCursorSamples.find((sample) => sample.chainageM === chainageM);
  if (exact !== undefined) {
    return exact.railElevationKnown ? toProfileCursor(exact, exaggeration) : null;
  }

  const upperIndex = tokyoMetroProfileCursorSamples.findIndex(
    (sample) => sample.chainageM > chainageM,
  );
  if (upperIndex <= 0) {
    return null;
  }

  const lower = tokyoMetroProfileCursorSamples[upperIndex - 1];
  const upper = tokyoMetroProfileCursorSamples[upperIndex];
  if (
    lower === undefined ||
    upper === undefined ||
    !lower.railElevationKnown ||
    !upper.railElevationKnown
  ) {
    return null;
  }

  const ratio = (chainageM - lower.chainageM) / (upper.chainageM - lower.chainageM);
  return toProfileCursor(
    {
      chainageM,
      segmentId: lower.segmentId,
      position: interpolatePosition(lower.position, upper.position, ratio),
      groundPosition: interpolatePosition(lower.groundPosition, upper.groundPosition, ratio),
      railElevationKnown: true,
    },
    exaggeration,
  );
}

function meanClearanceForPath(coordinates: readonly Position3D[]): number {
  if (coordinates.length === 0) {
    return -20;
  }
  const ground = groundElevationForIndex(0);
  const meanRail = coordinates.reduce((sum, point) => sum + point[2], 0) / coordinates.length;
  return meanRail - ground;
}

export const tokyoMetroRenderDataset: RenderDataset = {
  id: TOKYO_METRO_DATASET_ID,
  paths: pathDefs.map(
    (path): RenderPath => ({
      id: path.id,
      lineIds: [...path.lineIds],
      segmentId: path.segmentId,
      positionsByExaggeration: buildPositionsByExaggeration(path.coordinates),
      structure: 'underground_tunnel',
      meanClearanceM: meanClearanceForPath(path.coordinates),
      maxAbsGradientPermille: 35,
      confidence: 'low',
      lineColor: path.color,
    }),
  ),
  stations: allStations.map(
    (station): RenderStation => ({
      id: station.id,
      lineIds: [...station.lineIds],
      name: station.name,
      positionByExaggeration: buildPositionByExaggeration(station.position),
      confidence: 'low',
    }),
  ),
  guides,
  profileCursorByExaggeration: buildDefaultProfileCursors(),
  profileCursorSamples: tokyoMetroProfileCursorSamples,
};

function buildDefaultProfileCursors(): Record<VerticalExaggeration, ProfileCursor> {
  const sample = tokyoMetroProfileCursorSamples[3] ?? tokyoMetroProfileCursorSamples[0];
  if (sample === undefined) {
    throw new Error('Tokyo Metro profile samples must not be empty.');
  }
  return {
    1: toProfileCursor(sample, 1),
    2: toProfileCursor(sample, 2),
    3: toProfileCursor(sample, 3),
    5: toProfileCursor(sample, 5),
  };
}

export const tokyoMetroStationCatalog = {
  ginza: ginzaStations,
  marunouchi: marunouchiStations,
};
