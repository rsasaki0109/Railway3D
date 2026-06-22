import type {
  RenderPath,
  RenderStation,
  Selection,
  StructureType,
  VisualizationState,
} from './render-types';

export type Rgba = readonly [number, number, number, number];
export type Rgb = readonly [number, number, number];

const STRUCTURE_COLORS: Record<StructureType, Rgb> = {
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
};

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
  const [red, green, blue] =
    visualization.colorMode === 'structure' ? STRUCTURE_COLORS[path.structure] : path.lineColor;
  return [red, green, blue, path.confidence === 'unknown' ? 150 : 230];
}

export function resolvePathWidth(path: RenderPath, selection: Selection): number {
  return isPathSelected(path, selection) ? 6 : 3;
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
