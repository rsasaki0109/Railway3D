import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

import {
  MapLibreDeckRenderer,
  type MapRendererStatus,
} from '../../renderer/maplibre-deck/MapLibreDeckRenderer';
import {
  formatViewState,
  INITIAL_VIEW_STATE,
  type ViewStateSerializable,
} from '../../renderer/maplibre-deck/view-state';
import { getWebGL2Support } from '../../renderer/maplibre-deck/webgl-support';
import { VERTICAL_EXAGGERATIONS } from '../../renderer/railway/elevation';
import { getXRayPathCount } from '../../renderer/railway/layer-filters';
import type {
  ColorMode,
  Selection,
  VerticalExaggeration,
  VisualizationState,
  XRayMode,
} from '../../renderer/railway/render-types';
import {
  SYNTHETIC_LINE_ID,
  syntheticRenderDataset,
} from '../../renderer/railway/synthetic-render-dataset';

const basePath = import.meta.env.BASE_URL;
const xrayModes = ['off', 'selected', 'all-underground'] as const satisfies readonly XRayMode[];
const colorModes = ['line', 'structure'] as const satisfies readonly ColorMode[];

const DEFAULT_VISUALIZATION: VisualizationState = {
  colorMode: 'line',
  xrayMode: 'selected',
  verticalExaggeration: 1,
};

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getStatusLabel(status: MapRendererStatus): string {
  switch (status) {
    case 'checking':
      return 'Checking WebGL2 support';
    case 'loading':
      return 'Loading 3D map shell';
    case 'ready':
      return '3D map ready';
    case 'terrain-fallback':
      return 'Terrain unavailable; continuing with a flat map';
    case 'context-lost':
      return 'WebGL context lost; waiting for restoration';
    case 'unsupported':
      return 'WebGL2 is required for the 3D map shell';
  }
}

export function MapViewport() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<MapLibreDeckRenderer | null>(null);
  const [status, setStatus] = useState<MapRendererStatus>('checking');
  const [viewState, setViewState] = useState<ViewStateSerializable>(INITIAL_VIEW_STATE);
  const [visualization, setVisualization] = useState<VisualizationState>(DEFAULT_VISUALIZATION);
  const [selection, setSelection] = useState<Selection>({ kind: 'line', id: SYNTHETIC_LINE_ID });

  useEffect(() => {
    const support = getWebGL2Support();
    if (!support.supported) {
      setStatus('unsupported');
      return;
    }

    const container = containerRef.current;
    if (container === null || rendererRef.current !== null) {
      return;
    }

    const renderer = new MapLibreDeckRenderer();
    rendererRef.current = renderer;
    setStatus('loading');

    renderer.mount({
      basePath,
      container,
      onStatusChange: setStatus,
      onViewStateChange: setViewState,
      onSelectionChange: setSelection,
    });

    const resizeObserver = new ResizeObserver(() => {
      renderer.resize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setVisualization(visualization);
  }, [visualization]);

  useEffect(() => {
    rendererRef.current?.setSelection(selection);
  }, [selection]);

  const handleResetCamera = () => {
    rendererRef.current?.flyToInitialView({ reducedMotion: prefersReducedMotion() });
  };

  const handleXRayChange = (xrayMode: XRayMode) => {
    setVisualization((current) => ({ ...current, xrayMode }));
  };

  const handleColorModeChange = (colorMode: ColorMode) => {
    setVisualization((current) => ({ ...current, colorMode }));
  };

  const handleVerticalExaggerationChange = (verticalExaggeration: VerticalExaggeration) => {
    setVisualization((current) => ({ ...current, verticalExaggeration }));
  };

  const xrayPathCount = getXRayPathCount(syntheticRenderDataset, visualization.xrayMode, selection);
  const selectionLabel =
    selection === null
      ? 'None'
      : selection.kind === 'line'
        ? 'Golden Fixture Line'
        : selection.kind === 'station'
          ? selection.id.endsWith(':A')
            ? 'Station A'
            : 'Station C'
          : selection.id;

  return (
    <div className="map-viewport" data-testid="map-viewport">
      <div ref={containerRef} className="map-canvas" aria-label="Interactive 3D map shell" />
      <div className="map-overlay map-overlay-top">
        <p className="map-kicker">Map shell</p>
        <p className="map-status" data-testid="map-status" role="status">
          {getStatusLabel(status)}
        </p>
        <p data-testid="selection-status">Selected: {selectionLabel}</p>
      </div>
      <div className="map-overlay map-overlay-bottom">
        <p data-testid="view-state">{formatViewState(viewState)}</p>
        <p data-testid="xray-status">
          X-ray {visualization.xrayMode} · {xrayPathCount} path{xrayPathCount === 1 ? '' : 's'}
        </p>
        <p data-testid="vex-status">Vertical ×{visualization.verticalExaggeration}</p>
        <div className="segmented-control" aria-label="X-ray mode">
          {xrayModes.map((xrayMode) => (
            <button
              key={xrayMode}
              type="button"
              className="map-action"
              data-active={visualization.xrayMode === xrayMode}
              data-testid={`xray-${xrayMode}`}
              onClick={() => handleXRayChange(xrayMode)}
            >
              {xrayMode === 'all-underground' ? 'All' : xrayMode}
            </button>
          ))}
        </div>
        <div className="segmented-control" aria-label="Color mode">
          {colorModes.map((colorMode) => (
            <button
              key={colorMode}
              type="button"
              className="map-action"
              data-active={visualization.colorMode === colorMode}
              data-testid={`color-${colorMode}`}
              onClick={() => handleColorModeChange(colorMode)}
            >
              {colorMode}
            </button>
          ))}
        </div>
        <div className="segmented-control" aria-label="Vertical exaggeration">
          {VERTICAL_EXAGGERATIONS.map((verticalExaggeration) => (
            <button
              key={verticalExaggeration}
              type="button"
              className="map-action"
              data-active={visualization.verticalExaggeration === verticalExaggeration}
              data-testid={`vex-${verticalExaggeration}`}
              onClick={() => handleVerticalExaggerationChange(verticalExaggeration)}
            >
              ×{verticalExaggeration}
            </button>
          ))}
        </div>
        <p>Synthetic railway and terrain fixtures · no real railway data</p>
        <button type="button" className="map-action" onClick={handleResetCamera}>
          Reset camera
        </button>
      </div>
    </div>
  );
}
