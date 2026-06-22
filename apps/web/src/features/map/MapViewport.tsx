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

const basePath = import.meta.env.BASE_URL;

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

  const handleResetCamera = () => {
    rendererRef.current?.flyToInitialView({ reducedMotion: prefersReducedMotion() });
  };

  return (
    <div className="map-viewport" data-testid="map-viewport">
      <div ref={containerRef} className="map-canvas" aria-label="Interactive 3D map shell" />
      <div className="map-overlay map-overlay-top">
        <p className="map-kicker">Map shell</p>
        <p className="map-status" data-testid="map-status" role="status">
          {getStatusLabel(status)}
        </p>
      </div>
      <div className="map-overlay map-overlay-bottom">
        <p data-testid="view-state">{formatViewState(viewState)}</p>
        <p>Synthetic terrain fixture · no real railway data</p>
        <button type="button" className="map-action" onClick={handleResetCamera}>
          Reset camera
        </button>
      </div>
    </div>
  );
}
