import { describe, expect, it } from 'vitest';

import type { StructureType } from './render-types';
import {
  CONFIDENCE_COLORS,
  LOW_CONTRAST_LINE_FALLBACK,
  STRUCTURE_COLORS,
  contrastRatio,
  resolveClearanceColor,
  resolveGradientColor,
  resolveReadableLineColor,
} from './style-resolver';

const structureTypes = [
  'underground_tunnel',
  'cut_and_cover_tunnel',
  'mountain_tunnel',
  'undersea_tunnel',
  'station_box',
  'surface',
  'cutting',
  'embankment',
  'viaduct',
  'bridge',
  'at_grade_crossing',
  'depot',
  'unknown',
] as const satisfies readonly StructureType[];

describe('style-resolver', () => {
  it('keeps null clearance distinct from zero clearance', () => {
    expect(resolveClearanceColor(null)).toEqual([96, 104, 112]);
    expect(resolveClearanceColor(0)).toEqual([73, 125, 94]);
    expect(resolveClearanceColor(null)).not.toEqual(resolveClearanceColor(0));
  });

  it('applies clearance threshold boundaries exactly', () => {
    expect(resolveClearanceColor(-30)).toEqual([55, 83, 142]);
    expect(resolveClearanceColor(-29.9)).toEqual([67, 113, 171]);
    expect(resolveClearanceColor(10)).toEqual([73, 125, 94]);
    expect(resolveClearanceColor(10.1)).toEqual([169, 108, 47]);
    expect(resolveClearanceColor(30)).toEqual([169, 108, 47]);
    expect(resolveClearanceColor(30.1)).toEqual([143, 73, 58]);
  });

  it('applies gradient threshold boundaries exactly', () => {
    expect(resolveGradientColor(null)).toEqual([96, 104, 112]);
    expect(resolveGradientColor(9.9)).toEqual([64, 121, 86]);
    expect(resolveGradientColor(10)).toEqual([159, 119, 47]);
    expect(resolveGradientColor(24.9)).toEqual([159, 119, 47]);
    expect(resolveGradientColor(25)).toEqual([151, 75, 58]);
  });

  it('falls back when an official line color is too low contrast', () => {
    expect(resolveReadableLineColor([246, 248, 249])).toEqual(LOW_CONTRAST_LINE_FALLBACK);
    expect(resolveReadableLineColor([47, 111, 115])).toEqual([47, 111, 115]);
    expect(contrastRatio(LOW_CONTRAST_LINE_FALLBACK, [246, 248, 249])).toBeGreaterThan(3);
  });

  it('covers every structure and confidence enum value', () => {
    expect(Object.keys(STRUCTURE_COLORS).sort()).toEqual([...structureTypes].sort());
    expect(Object.keys(CONFIDENCE_COLORS).sort()).toEqual([
      'high',
      'low',
      'medium',
      'unknown',
      'verified',
    ]);
  });
});
