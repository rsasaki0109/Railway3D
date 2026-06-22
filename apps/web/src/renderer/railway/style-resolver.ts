import type {
  ColorMode,
  ConfidenceLevel,
  RenderPath,
  RenderStation,
  Selection,
  StructureType,
  VisualizationState,
} from './render-types';

export type Rgba = readonly [number, number, number, number];
export type Rgb = readonly [number, number, number];

export const LOW_CONTRAST_LINE_FALLBACK: Rgb = [16, 40, 32];
const MAP_BACKGROUND: Rgb = [246, 248, 249];

export const STRUCTURE_COLORS = {
  underground_tunnel: [70, 94, 142],
  cut_and_cover_tunnel: [75, 106, 160],
  mountain_tunnel: [92, 82, 146],
  undersea_tunnel: [48, 112, 139],
  station_box: [113, 89, 159],
  surface: [44, 116, 91],
  cutting: [102, 119, 67],
  embankment: [128, 117, 65],
  viaduct: [172, 95, 42],
  bridge: [150, 71, 62],
  at_grade_crossing: [72, 112, 83],
  depot: [106, 106, 106],
  unknown: [96, 104, 112],
} as const satisfies Record<StructureType, Rgb>;

export const CONFIDENCE_COLORS = {
  verified: [32, 96, 72],
  high: [68, 120, 78],
  medium: [147, 121, 55],
  low: [146, 82, 59],
  unknown: [96, 104, 112],
} as const satisfies Record<ConfidenceLevel, Rgb>;

const CLEARANCE_COLORS = {
  deepUnderground: [55, 83, 142],
  underground: [67, 113, 171],
  nearSurface: [73, 125, 94],
  elevated: [169, 108, 47],
  highElevated: [143, 73, 58],
  unknown: [96, 104, 112],
} as const satisfies Record<string, Rgb>;

const GRADIENT_COLORS = {
  gentle: [64, 121, 86],
  moderate: [159, 119, 47],
  steep: [151, 75, 58],
  unknown: [96, 104, 112],
} as const satisfies Record<string, Rgb>;

function relativeLuminance([red, green, blue]: Rgb): number {
  const components = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = components;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(first: Rgb, second: Rgb): number {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

export function resolveReadableLineColor(lineColor: Rgb): Rgb {
  return contrastRatio(lineColor, MAP_BACKGROUND) >= 3 ? lineColor : LOW_CONTRAST_LINE_FALLBACK;
}

export function resolveClearanceColor(clearanceM: number | null): Rgb {
  if (clearanceM === null) {
    return CLEARANCE_COLORS.unknown;
  }

  if (clearanceM <= -30) {
    return CLEARANCE_COLORS.deepUnderground;
  }

  if (clearanceM < 0) {
    return CLEARANCE_COLORS.underground;
  }

  if (clearanceM <= 10) {
    return CLEARANCE_COLORS.nearSurface;
  }

  if (clearanceM <= 30) {
    return CLEARANCE_COLORS.elevated;
  }

  return CLEARANCE_COLORS.highElevated;
}

export function resolveGradientColor(maxAbsGradientPermille: number | null): Rgb {
  if (maxAbsGradientPermille === null) {
    return GRADIENT_COLORS.unknown;
  }

  if (maxAbsGradientPermille < 10) {
    return GRADIENT_COLORS.gentle;
  }

  if (maxAbsGradientPermille < 25) {
    return GRADIENT_COLORS.moderate;
  }

  return GRADIENT_COLORS.steep;
}

export function resolvePathRgb(path: RenderPath, colorMode: ColorMode): Rgb {
  switch (colorMode) {
    case 'line':
      return resolveReadableLineColor(path.lineColor);
    case 'structure':
      return STRUCTURE_COLORS[path.structure];
    case 'clearance':
      return resolveClearanceColor(path.meanClearanceM);
    case 'gradient':
      return resolveGradientColor(path.maxAbsGradientPermille);
    case 'confidence':
      return CONFIDENCE_COLORS[path.confidence];
  }
}

export function isPathSelected(path: RenderPath, selection: Selection): boolean {
  if (selection === null) {
    return false;
  }
  if (selection.kind === 'line') {
    return path.lineIds.includes(selection.id);
  }
  if (selection.kind === 'segment') {
    return path.segmentId === selection.id;
  }
  return false;
}

export function isStationSelected(station: RenderStation, selection: Selection): boolean {
  return selection?.kind === 'station' && station.id === selection.id;
}

export function resolvePathColor(path: RenderPath, visualization: VisualizationState): Rgba {
  const [red, green, blue] = resolvePathRgb(path, visualization.colorMode);
  const alpha = path.confidence === 'unknown' || path.meanClearanceM === null ? 160 : 230;
  return [red, green, blue, alpha];
}

export function resolvePathWidth(
  path: RenderPath,
  selection: Selection,
  visualization?: VisualizationState,
): number {
  const selectedWidth = isPathSelected(path, selection) ? 6 : 3;
  if (visualization?.uncertaintyVisible === true && path.confidence === 'low') {
    return selectedWidth + 1;
  }

  if (visualization?.uncertaintyVisible === true && path.confidence === 'unknown') {
    return selectedWidth + 2;
  }

  return selectedWidth;
}

export function shouldRenderUncertaintyCue(path: RenderPath): boolean {
  return path.confidence === 'low' || path.confidence === 'unknown' || path.meanClearanceM === null;
}

export function resolveUncertaintyCueColor(path: RenderPath): Rgba {
  return path.meanClearanceM === null ? [96, 104, 112, 120] : [16, 40, 32, 76];
}

export function resolveStationColor(station: RenderStation, selection: Selection): Rgba {
  return isStationSelected(station, selection) ? [255, 246, 184, 255] : [247, 250, 248, 235];
}

export function resolveStationLineColor(station: RenderStation, selection: Selection): Rgba {
  return isStationSelected(station, selection) ? [16, 40, 32, 255] : [68, 102, 92, 230];
}

export function resolveXRayHaloColor(): Rgba {
  return [78, 126, 255, 88];
}

export function resolveXRayCoreColor(): Rgba {
  return [202, 227, 255, 220];
}
