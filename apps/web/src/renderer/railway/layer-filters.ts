import type { RenderDataset, RenderPath, Selection, XRayMode } from './render-types';
import { isPathSelected } from './style-resolver';

export function pathHasXRay(path: RenderPath): boolean {
  return (
    path.structure.includes('tunnel') ||
    path.structure === 'station_box' ||
    (path.meanClearanceM !== null && path.meanClearanceM < 0)
  );
}

export function filterXRayPaths(
  paths: readonly RenderPath[],
  xrayMode: XRayMode,
  selection: Selection,
): readonly RenderPath[] {
  if (xrayMode === 'off') {
    return [];
  }

  const underground = paths.filter(pathHasXRay);
  if (xrayMode === 'all-underground') {
    return underground;
  }

  return underground.filter((path) => isPathSelected(path, selection));
}

export function getXRayPathCount(
  dataset: RenderDataset,
  xrayMode: XRayMode,
  selection: Selection,
): number {
  return filterXRayPaths(dataset.paths, xrayMode, selection).length;
}
