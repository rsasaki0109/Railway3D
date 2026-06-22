import { createAppState, type AppState } from './app-state';
import type { ViewStateSerializable } from '../renderer/maplibre-deck/view-state';
import type {
  ColorMode,
  EntityId,
  Selection,
  VerticalExaggeration,
  XRayMode,
} from '../renderer/railway/render-types';

const CAMERA_PREFIX = '#/@';
const ENTITY_ID_PATTERN = /^r3d:[A-Za-z0-9._:-]+$/;
const MIN_PROFILE_CHAINAGE_M = 0;
const MAX_PROFILE_CHAINAGE_M = 1_000_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parseFiniteNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number, fractionDigits: number): number {
  return Number(value.toFixed(fractionDigits));
}

function isEntityId(value: string | null): value is EntityId {
  return value !== null && ENTITY_ID_PATTERN.test(value);
}

function parseColorMode(value: string | null, fallback: ColorMode): ColorMode {
  switch (value) {
    case 'line':
    case 'structure':
    case 'clearance':
    case 'gradient':
    case 'confidence':
      return value;
    default:
      return fallback;
  }
}

function parseXRayMode(value: string | null, fallback: XRayMode): XRayMode {
  if (value === 'off' || value === 'selected') {
    return value;
  }

  if (value === 'all' || value === 'all-underground') {
    return 'all-underground';
  }

  return fallback;
}

function parseVerticalExaggeration(
  value: string | null,
  fallback: VerticalExaggeration,
): VerticalExaggeration {
  switch (value) {
    case '1':
      return 1;
    case '2':
      return 2;
    case '3':
      return 3;
    case '5':
      return 5;
    default:
      return fallback;
  }
}

function parseBooleanFlag(value: string | null, fallback: boolean): boolean {
  if (value === '1' || value === 'true') {
    return true;
  }

  if (value === '0' || value === 'false') {
    return false;
  }

  return fallback;
}

function parseProfileChainage(value: string | null, fallback: number | null): number | null {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return round(clamp(parsed, MIN_PROFILE_CHAINAGE_M, MAX_PROFILE_CHAINAGE_M), 1);
}

export function clampViewState(view: ViewStateSerializable): ViewStateSerializable {
  return {
    longitude: round(clamp(view.longitude, -180, 180), 5),
    latitude: round(clamp(view.latitude, -85, 85), 5),
    zoom: round(clamp(view.zoom, 0, 22), 2),
    pitch: round(clamp(view.pitch, 0, 75), 1),
    bearing: round(clamp(view.bearing, -180, 180), 1),
  };
}

function parseCamera(hashPath: string, fallback: ViewStateSerializable): ViewStateSerializable {
  if (!hashPath.startsWith(CAMERA_PREFIX)) {
    return fallback;
  }

  const rawCamera = hashPath.slice(CAMERA_PREFIX.length).split(',');
  return clampViewState({
    latitude: parseFiniteNumber(rawCamera[0], fallback.latitude),
    longitude: parseFiniteNumber(rawCamera[1], fallback.longitude),
    zoom: parseFiniteNumber(rawCamera[2], fallback.zoom),
    pitch: parseFiniteNumber(rawCamera[3], fallback.pitch),
    bearing: parseFiniteNumber(rawCamera[4], fallback.bearing),
  });
}

function parseSelection(params: URLSearchParams, fallback: Selection): Selection {
  const stationId = params.get('station');
  if (isEntityId(stationId)) {
    return { kind: 'station', id: stationId };
  }

  const lineId = params.get('line');
  if (isEntityId(lineId)) {
    return { kind: 'line', id: lineId };
  }

  return fallback;
}

export function parseUrlState(hash: string, fallback: AppState = createAppState()): AppState {
  const hashWithoutPrefix = hash.startsWith('#') ? hash : `#${hash}`;
  const [hashPath = '', rawQuery = ''] = hashWithoutPrefix.split('?');
  const params = new URLSearchParams(rawQuery);

  return createAppState({
    ...fallback,
    view: parseCamera(hashPath, fallback.view),
    visualization: {
      colorMode: parseColorMode(params.get('mode'), fallback.visualization.colorMode),
      xrayMode: parseXRayMode(params.get('xray'), fallback.visualization.xrayMode),
      verticalExaggeration: parseVerticalExaggeration(
        params.get('vex'),
        fallback.visualization.verticalExaggeration,
      ),
      stationVisible: parseBooleanFlag(
        params.get('stations'),
        fallback.visualization.stationVisible,
      ),
      labelVisible: parseBooleanFlag(params.get('labels'), fallback.visualization.labelVisible),
      guideVisible: parseBooleanFlag(params.get('guides'), fallback.visualization.guideVisible),
      uncertaintyVisible: parseBooleanFlag(
        params.get('uncertainty'),
        fallback.visualization.uncertaintyVisible,
      ),
    },
    selection: parseSelection(params, fallback.selection),
    profileCursorChainageM: parseProfileChainage(
      params.get('profile'),
      fallback.profileCursorChainageM,
    ),
  });
}

function formatNumber(value: number, fractionDigits: number): string {
  return value.toFixed(fractionDigits).replace(/\.?0+$/, '');
}

export function serializeUrlState(state: AppState): string {
  const view = clampViewState(state.view);
  const params = new URLSearchParams();

  if (state.selection?.kind === 'line') {
    params.set('line', state.selection.id);
  }

  if (state.selection?.kind === 'station') {
    params.set('station', state.selection.id);
  }

  params.set('mode', state.visualization.colorMode);
  params.set(
    'xray',
    state.visualization.xrayMode === 'all-underground' ? 'all' : state.visualization.xrayMode,
  );
  params.set('vex', String(state.visualization.verticalExaggeration));
  params.set('stations', state.visualization.stationVisible ? '1' : '0');
  params.set('labels', state.visualization.labelVisible ? '1' : '0');
  params.set('guides', state.visualization.guideVisible ? '1' : '0');
  params.set('uncertainty', state.visualization.uncertaintyVisible ? '1' : '0');
  if (state.profileCursorChainageM !== null) {
    params.set('profile', formatNumber(state.profileCursorChainageM, 1));
  }

  const camera = [
    formatNumber(view.latitude, 5),
    formatNumber(view.longitude, 5),
    formatNumber(view.zoom, 2),
    formatNumber(view.pitch, 1),
    formatNumber(view.bearing, 1),
  ].join(',');

  return `${CAMERA_PREFIX}${camera}?${params.toString()}`;
}
