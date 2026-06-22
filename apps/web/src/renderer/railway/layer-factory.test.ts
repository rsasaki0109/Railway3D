import { describe, expect, it, vi } from 'vitest';

import { buildRailwayLayers } from './layer-factory';
import { filterXRayPaths } from './layer-filters';
import { SYNTHETIC_LINE_ID, syntheticRenderDataset } from './synthetic-render-dataset';
import type { LayerBuildContext, RenderPath, VisualizationState } from './render-types';

const baseVisualization: VisualizationState = {
  colorMode: 'line',
  xrayMode: 'selected',
  verticalExaggeration: 1,
  stationVisible: true,
  labelVisible: true,
  guideVisible: true,
  uncertaintyVisible: true,
};

function buildContext(visualization: VisualizationState = baseVisualization): LayerBuildContext {
  return {
    dataset: syntheticRenderDataset,
    visualization,
    selection: { kind: 'line', id: SYNTHETIC_LINE_ID },
    hovered: null,
    profileCursor:
      syntheticRenderDataset.profileCursorByExaggeration[visualization.verticalExaggeration],
    callbacks: {
      onHover: vi.fn(),
      onSelect: vi.fn(),
    },
  };
}

describe('buildRailwayLayers', () => {
  it('creates the PR-007 layer set with stable ids', () => {
    expect(buildRailwayLayers(buildContext()).map((layer) => layer.id)).toEqual([
      'uncertainty-cue',
      'railway-physical',
      'railway-xray-halo',
      'railway-xray-core',
      'station-points',
      'station-labels',
      'selection-halo',
      'profile-cursor',
      'vertical-guide',
    ]);
  });

  it('keeps X-ray and guide layers out of picking', () => {
    const layers = buildRailwayLayers(buildContext());
    const physical = layers.find((layer) => layer.id === 'railway-physical');
    const uncertaintyCue = layers.find((layer) => layer.id === 'uncertainty-cue');
    const xrayHalo = layers.find((layer) => layer.id === 'railway-xray-halo');
    const verticalGuide = layers.find((layer) => layer.id === 'vertical-guide');

    expect(physical?.props.pickable).toBe(true);
    expect(uncertaintyCue?.props.pickable).toBe(false);
    expect(xrayHalo?.props.pickable).toBe(false);
    expect(verticalGuide?.props.pickable).toBe(false);
  });

  it('prevents X-ray duplication for surface structures', () => {
    const xrayPaths = filterXRayPaths(syntheticRenderDataset.paths, 'all-underground', {
      kind: 'line',
      id: SYNTHETIC_LINE_ID,
    });

    expect(xrayPaths).toHaveLength(1);
    expect(xrayPaths[0]?.structure).toBe('underground_tunnel');
  });

  it('does not regenerate geometry arrays for color mode changes', () => {
    const [path] = syntheticRenderDataset.paths;
    const lineGeometry = path?.positionsByExaggeration[1];
    const structureLayer = buildRailwayLayers(
      buildContext({ ...baseVisualization, colorMode: 'structure' }),
    ).find((layer) => layer.id === 'railway-physical');
    const lineLayer = buildRailwayLayers(
      buildContext({ ...baseVisualization, colorMode: 'line' }),
    ).find((layer) => layer.id === 'railway-physical');

    expect(
      (structureLayer?.props.data as readonly RenderPath[])[0]?.positionsByExaggeration[1],
    ).toBe(lineGeometry);
    expect((lineLayer?.props.data as readonly RenderPath[])[0]?.positionsByExaggeration[1]).toBe(
      lineGeometry,
    );
  });

  it('uses layer toggles without deleting the underlying render dataset', () => {
    const layers = buildRailwayLayers(
      buildContext({
        ...baseVisualization,
        stationVisible: false,
        labelVisible: false,
        guideVisible: false,
        uncertaintyVisible: false,
      }),
    );
    const physical = layers.find((layer) => layer.id === 'railway-physical');
    const uncertainty = layers.find((layer) => layer.id === 'uncertainty-cue');
    const stations = layers.find((layer) => layer.id === 'station-points');
    const labels = layers.find((layer) => layer.id === 'station-labels');
    const cursor = layers.find((layer) => layer.id === 'profile-cursor');
    const guide = layers.find((layer) => layer.id === 'vertical-guide');

    expect(physical?.props.data).toHaveLength(syntheticRenderDataset.paths.length);
    expect(uncertainty?.props.data).toHaveLength(0);
    expect(stations?.props.data).toHaveLength(0);
    expect(labels?.props.data).toHaveLength(0);
    expect(cursor?.props.data).toHaveLength(0);
    expect(guide?.props.data).toHaveLength(0);
  });
});
