import type { VerticalExaggeration } from './render-types';

export const VERTICAL_EXAGGERATIONS = [
  1, 2, 3, 5,
] as const satisfies readonly VerticalExaggeration[];

export function toRenderElevation(zM: number, exaggeration: VerticalExaggeration): number {
  return zM * exaggeration;
}
