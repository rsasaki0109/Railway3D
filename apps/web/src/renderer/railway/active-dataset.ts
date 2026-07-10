import type { RenderDataset } from './render-types';
import {
  resolveTokyoMetroProfileCursor,
  TOKYO_METRO_DATASET_ID,
  TOKYO_METRO_GINZA_LINE_ID,
  tokyoMetroRenderDataset,
} from './tokyo-metro-render-dataset';

/** Active development-build dataset shown on GitHub Pages. */
export const ACTIVE_DATASET_ID = TOKYO_METRO_DATASET_ID;
export const ACTIVE_LINE_ID = TOKYO_METRO_GINZA_LINE_ID;
export const activeRenderDataset: RenderDataset = tokyoMetroRenderDataset;
export const resolveActiveProfileCursor = resolveTokyoMetroProfileCursor;
