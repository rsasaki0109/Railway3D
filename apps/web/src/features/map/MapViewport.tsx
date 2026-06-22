import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useAppStore } from '../../app/app-store';
import { getSelectionDisplay } from '../inspector/selection-display';
import {
  MapLibreDeckRenderer,
  type MapRendererStatus,
} from '../../renderer/maplibre-deck/MapLibreDeckRenderer';
import { formatViewState } from '../../renderer/maplibre-deck/view-state';
import { getWebGL2Support } from '../../renderer/maplibre-deck/webgl-support';
import { VERTICAL_EXAGGERATIONS } from '../../renderer/railway/elevation';
import { getXRayPathCount } from '../../renderer/railway/layer-filters';
import type {
  ColorMode,
  VerticalExaggeration,
  XRayMode,
} from '../../renderer/railway/render-types';
import { syntheticRenderDataset } from '../../renderer/railway/synthetic-render-dataset';

const basePath = import.meta.env.BASE_URL;
const xrayModes = ['off', 'selected', 'all-underground'] as const satisfies readonly XRayMode[];
const colorModes = ['line', 'structure'] as const satisfies readonly ColorMode[];

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
  const { state, dispatch } = useAppStore();
  const initialViewRef = useRef(state.view);
  const [status, setStatus] = useState<MapRendererStatus>('checking');

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
      initialViewState: initialViewRef.current,
      onStatusChange: setStatus,
      onViewStateChange: (view) => dispatch({ type: 'set-view', view }),
      onSelectionChange: (selection) => dispatch({ type: 'set-selection', selection }),
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
  }, [dispatch]);

  useEffect(() => {
    rendererRef.current?.setVisualization(state.visualization);
  }, [state.visualization]);

  useEffect(() => {
    rendererRef.current?.setSelection(state.selection);
  }, [state.selection]);

  useEffect(() => {
    rendererRef.current?.setViewState(state.view);
  }, [state.view]);

  const handleResetCamera = () => {
    rendererRef.current?.flyToInitialView({ reducedMotion: prefersReducedMotion() });
  };

  const handleXRayChange = (xrayMode: XRayMode) => {
    dispatch({
      type: 'set-visualization',
      visualization: { ...state.visualization, xrayMode },
    });
  };

  const handleColorModeChange = (colorMode: ColorMode) => {
    dispatch({
      type: 'set-visualization',
      visualization: { ...state.visualization, colorMode },
    });
  };

  const handleVerticalExaggerationChange = (verticalExaggeration: VerticalExaggeration) => {
    dispatch({
      type: 'set-visualization',
      visualization: { ...state.visualization, verticalExaggeration },
    });
  };

  const xrayPathCount = getXRayPathCount(
    syntheticRenderDataset,
    state.visualization.xrayMode,
    state.selection,
  );
  const selectionLabel = getSelectionDisplay(state.selection).title;

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
        <p data-testid="view-state">{formatViewState(state.view)}</p>
        <p data-testid="xray-status">
          X-ray {state.visualization.xrayMode} · {xrayPathCount} path
          {xrayPathCount === 1 ? '' : 's'}
        </p>
        <p data-testid="vex-status">Vertical ×{state.visualization.verticalExaggeration}</p>
        <div className="segmented-control" aria-label="X-ray mode">
          {xrayModes.map((xrayMode) => (
            <button
              key={xrayMode}
              type="button"
              className="map-action"
              data-active={state.visualization.xrayMode === xrayMode}
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
              data-active={state.visualization.colorMode === colorMode}
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
              data-active={state.visualization.verticalExaggeration === verticalExaggeration}
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
