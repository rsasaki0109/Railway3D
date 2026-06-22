import { describe, expect, it } from 'vitest';

import { createAppState } from '../../app/app-state';
import type { ColorMode, StructureType } from '../../renderer/railway/render-types';
import {
  STRUCTURE_LABELS,
  getLegendDefinition,
  getVisualizationBadges,
} from './legend-definitions';

const colorModes = [
  'line',
  'structure',
  'clearance',
  'gradient',
  'confidence',
] as const satisfies readonly ColorMode[];

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

describe('legend-definitions', () => {
  it('returns a legend for every color mode', () => {
    expect(colorModes.map((mode) => getLegendDefinition(mode).title)).toEqual([
      'Line color',
      'Structure',
      'Ground clearance',
      'Gradient',
      'Confidence',
    ]);
  });

  it('documents unknown clearance without treating it as zero', () => {
    const legend = getLegendDefinition('clearance');

    expect(legend.entries.map((entry) => entry.label)).toContain('Unknown clearance');
    expect(legend.notes).toContain('Null clearance is not converted to zero.');
  });

  it('keeps structure labels exhaustive', () => {
    expect(Object.keys(STRUCTURE_LABELS).sort()).toEqual([...structureTypes].sort());
  });

  it('builds visualization badges from current state', () => {
    const state = createAppState({
      visualization: {
        colorMode: 'gradient',
        xrayMode: 'all-underground',
        verticalExaggeration: 5,
        stationVisible: true,
        labelVisible: true,
        guideVisible: true,
        uncertaintyVisible: false,
      },
    });

    expect(getVisualizationBadges(state.visualization)).toEqual([
      'X-ray all-underground',
      'Vertical x5',
      'Uncertainty off',
    ]);
  });
});
