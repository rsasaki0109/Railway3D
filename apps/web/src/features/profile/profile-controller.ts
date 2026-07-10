import type { ViewStateSerializable } from '../../renderer/maplibre-deck/view-state';
import type {
  ConfidenceLevel,
  EntityId,
  Selection,
  StructureType,
} from '../../renderer/railway/render-types';
import { ACTIVE_LINE_ID } from '../../renderer/railway/active-dataset';
import {
  TOKYO_METRO_GINZA_LINE_ID,
  tokyoMetroStationCatalog,
} from '../../renderer/railway/tokyo-metro-render-dataset';
import { SYNTHETIC_LINE_ID } from '../../renderer/railway/synthetic-render-dataset';

export const SYNTHETIC_PROFILE_SAMPLE_INTERVAL_M = 500;
export const SYNTHETIC_PROFILE_TOTAL_LENGTH_M = 3000;
export const TOKYO_METRO_PROFILE_SAMPLE_INTERVAL_M = 800;
/** Default cursor on Ginza Line pilot (上野 ≈ 2.4 km from 浅草). */
export const DEFAULT_PROFILE_CURSOR_CHAINAGE_M = 2400;

export interface ProfileSample {
  chainageM: number;
  position: readonly [longitude: number, latitude: number];
  railElevationM: number | null;
  groundElevationM: number | null;
  clearanceM: number | null;
  gradientPermille: number | null;
  uncertaintyM: number;
  structure: StructureType;
  confidence: ConfidenceLevel;
  segmentId: EntityId;
}

export interface ProfileMarker {
  chainageM: number;
  label: string;
  kind: 'station' | 'portal' | 'structure';
}

export interface SyntheticElevationProfile {
  id: EntityId;
  title: string;
  sampleIntervalTargetM: number;
  totalLengthM: number;
  samples: readonly ProfileSample[];
  markers: readonly ProfileMarker[];
}

export interface RailPathSegment {
  id: string;
  samples: readonly ProfileSample[];
}

export class ProfileLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileLoadError';
  }
}

export const syntheticElevationProfile: SyntheticElevationProfile = {
  id: 'r3d:zz:synthetic:profile:golden-main',
  title: 'Golden synthetic elevation profile',
  sampleIntervalTargetM: SYNTHETIC_PROFILE_SAMPLE_INTERVAL_M,
  totalLengthM: SYNTHETIC_PROFILE_TOTAL_LENGTH_M,
  samples: [
    {
      chainageM: 0,
      position: [139.61, 35.72],
      railElevationM: -18,
      groundElevationM: 12,
      clearanceM: -30,
      gradientPermille: 20,
      uncertaintyM: 0.4,
      structure: 'underground_tunnel',
      confidence: 'verified',
      segmentId: 'r3d:zz:synthetic:segment:s01-underground',
    },
    {
      chainageM: 500,
      position: [139.66, 35.705],
      railElevationM: -8,
      groundElevationM: 8,
      clearanceM: -16,
      gradientPermille: 20,
      uncertaintyM: 0.6,
      structure: 'underground_tunnel',
      confidence: 'high',
      segmentId: 'r3d:zz:synthetic:segment:s01-underground',
    },
    {
      chainageM: 1000,
      position: [139.71, 35.692],
      railElevationM: 2,
      groundElevationM: 6,
      clearanceM: -4,
      gradientPermille: 4,
      uncertaintyM: 0.5,
      structure: 'underground_tunnel',
      confidence: 'verified',
      segmentId: 'r3d:zz:synthetic:segment:s01-underground',
    },
    {
      chainageM: 1500,
      position: [139.745, 35.686],
      railElevationM: 4,
      groundElevationM: 4.5,
      clearanceM: -0.5,
      gradientPermille: 2,
      uncertaintyM: 1.6,
      structure: 'surface',
      confidence: 'low',
      segmentId: 'r3d:zz:synthetic:segment:s02-surface',
    },
    {
      chainageM: 2000,
      position: [139.78, 35.68],
      railElevationM: null,
      groundElevationM: 5,
      clearanceM: null,
      gradientPermille: null,
      uncertaintyM: 6,
      structure: 'viaduct',
      confidence: 'unknown',
      segmentId: 'r3d:zz:synthetic:segment:s03-viaduct',
    },
    {
      chainageM: 2500,
      position: [139.83, 35.675],
      railElevationM: 14,
      groundElevationM: 5,
      clearanceM: 9,
      gradientPermille: 18,
      uncertaintyM: 2.2,
      structure: 'viaduct',
      confidence: 'medium',
      segmentId: 'r3d:zz:synthetic:segment:s03-viaduct',
    },
    {
      chainageM: 3000,
      position: [139.92, 35.656],
      railElevationM: 22,
      groundElevationM: 4,
      clearanceM: 18,
      gradientPermille: 16,
      uncertaintyM: 1,
      structure: 'bridge',
      confidence: 'high',
      segmentId: 'r3d:zz:synthetic:segment:s04-bridge',
    },
  ],
  markers: [
    { chainageM: 0, label: 'Station A', kind: 'station' },
    { chainageM: 1000, label: 'Portal', kind: 'portal' },
    { chainageM: 3000, label: 'Station C', kind: 'station' },
  ],
};

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

export const tokyoMetroGinzaElevationProfile: SyntheticElevationProfile = {
  id: 'r3d:jp:tokyometro:profile:ginza-main',
  title: '銀座線 浅草–渋谷（illustrative profile）',
  sampleIntervalTargetM: TOKYO_METRO_PROFILE_SAMPLE_INTERVAL_M,
  totalLengthM: (tokyoMetroStationCatalog.ginza.length - 1) * TOKYO_METRO_PROFILE_SAMPLE_INTERVAL_M,
  samples: tokyoMetroStationCatalog.ginza.map((station, index) => {
    const chainageM = index * TOKYO_METRO_PROFILE_SAMPLE_INTERVAL_M;
    const groundElevationM = 12 + (index % 5);
    const railKnown = station.number !== 'G-10';
    const railElevationM = railKnown ? station.position[2] : null;
    const clearanceM = railElevationM === null ? null : railElevationM - groundElevationM;
    return {
      chainageM,
      position: [station.position[0], station.position[1]] as const,
      railElevationM,
      groundElevationM,
      clearanceM,
      gradientPermille: railKnown ? 8 : null,
      uncertaintyM: railKnown ? 4 : 8,
      structure: 'underground_tunnel' as const,
      confidence: 'low' as const,
      segmentId: 'r3d:jp:tokyometro:segment:ginza-main',
    };
  }),
  markers: [
    { chainageM: 0, label: '浅草', kind: 'station' },
    {
      chainageM: 3 * TOKYO_METRO_PROFILE_SAMPLE_INTERVAL_M,
      label: '上野',
      kind: 'station',
    },
    {
      chainageM:
        (tokyoMetroStationCatalog.ginza.length - 1) * TOKYO_METRO_PROFILE_SAMPLE_INTERVAL_M,
      label: '渋谷',
      kind: 'station',
    },
  ],
};

export function loadSyntheticProfileForSelection(
  selection: Selection,
): Promise<SyntheticElevationProfile> {
  if (selection?.kind === 'line' && selection.id === SYNTHETIC_LINE_ID) {
    return Promise.resolve(syntheticElevationProfile);
  }

  if (
    selection?.kind === 'line' &&
    (selection.id === TOKYO_METRO_GINZA_LINE_ID || selection.id === ACTIVE_LINE_ID)
  ) {
    return Promise.resolve(tokyoMetroGinzaElevationProfile);
  }

  return Promise.reject(
    new ProfileLoadError('Elevation profile is available for 銀座線 (Tokyo Metro pilot).'),
  );
}

export function isChainageWithinProfile(
  profile: SyntheticElevationProfile,
  chainageM: number | null,
): chainageM is number {
  return (
    chainageM !== null &&
    Number.isFinite(chainageM) &&
    chainageM >= 0 &&
    chainageM <= profile.totalLengthM
  );
}

export function splitRailSegments(samples: readonly ProfileSample[]): readonly RailPathSegment[] {
  const segments: RailPathSegment[] = [];
  let current: ProfileSample[] = [];

  for (const sample of samples) {
    if (sample.railElevationM === null) {
      if (current.length > 1) {
        segments.push({ id: `rail-${segments.length}`, samples: current });
      }
      current = [];
      continue;
    }

    current.push(sample);
  }

  if (current.length > 1) {
    segments.push({ id: `rail-${segments.length}`, samples: current });
  }

  return segments;
}

export function getFiniteElevationValues(samples: readonly ProfileSample[]): readonly number[] {
  return samples.flatMap((sample) => {
    const values: number[] = [];
    if (sample.groundElevationM !== null && isFiniteNumber(sample.groundElevationM)) {
      values.push(sample.groundElevationM);
    }
    if (sample.railElevationM !== null && isFiniteNumber(sample.railElevationM)) {
      values.push(sample.railElevationM - sample.uncertaintyM);
      values.push(sample.railElevationM);
      values.push(sample.railElevationM + sample.uncertaintyM);
    }
    return values;
  });
}

export function findNearestProfileSample(
  profile: SyntheticElevationProfile,
  chainageM: number,
): ProfileSample {
  const first = profile.samples[0];
  if (first === undefined) {
    throw new Error('Profile has no samples.');
  }

  return profile.samples.reduce((nearest, sample) => {
    return Math.abs(sample.chainageM - chainageM) < Math.abs(nearest.chainageM - chainageM)
      ? sample
      : nearest;
  }, first);
}

export function stepProfileCursor(
  profile: SyntheticElevationProfile,
  currentChainageM: number | null,
  direction: -1 | 1,
): number {
  const current =
    currentChainageM === null
      ? DEFAULT_PROFILE_CURSOR_CHAINAGE_M
      : findNearestProfileSample(profile, currentChainageM).chainageM;
  const currentIndex = profile.samples.findIndex((sample) => sample.chainageM === current);
  const nextIndex = Math.min(Math.max(currentIndex + direction, 0), profile.samples.length - 1);
  const nextSample = profile.samples[nextIndex];

  return nextSample?.chainageM ?? current;
}

export function clampProfileChainage(
  profile: SyntheticElevationProfile,
  chainageM: number,
): number {
  return Math.min(Math.max(chainageM, 0), profile.totalLengthM);
}

export function formatChainageKm(chainageM: number): string {
  return `${(chainageM / 1000).toFixed(2)} km`;
}

export function formatElevation(valueM: number | null): string {
  if (valueM === null) {
    return 'unknown';
  }

  const prefix = valueM > 0 ? '+' : '';
  return `${prefix}${valueM.toFixed(1)} m`;
}

export function formatPermille(value: number | null): string {
  return value === null ? 'unknown' : `${value.toFixed(1)} permille`;
}

export function fitProfileRangeToView(
  profile: SyntheticElevationProfile,
  range: readonly [number, number],
): ViewStateSerializable {
  const [from, to] = range[0] <= range[1] ? range : [range[1], range[0]];
  const samplesInRange = profile.samples.filter(
    (sample) => sample.chainageM >= from && sample.chainageM <= to,
  );
  const samples = samplesInRange.length > 0 ? samplesInRange : profile.samples;
  const sum = samples.reduce(
    (accumulator, sample) => ({
      longitude: accumulator.longitude + sample.position[0],
      latitude: accumulator.latitude + sample.position[1],
    }),
    { longitude: 0, latitude: 0 },
  );
  const count = samples.length || 1;

  return {
    longitude: Number((sum.longitude / count).toFixed(5)),
    latitude: Number((sum.latitude / count).toFixed(5)),
    zoom: 12.7,
    pitch: 55,
    bearing: -28,
  };
}
