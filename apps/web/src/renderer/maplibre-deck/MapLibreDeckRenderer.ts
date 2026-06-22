import { MapboxOverlay } from '@deck.gl/mapbox';
import maplibregl, {
  AttributionControl,
  NavigationControl,
  type ErrorEvent,
  type IControl,
  type Map,
} from 'maplibre-gl';

import { createRailway3DMapStyle, SYNTHETIC_DEM_SOURCE_ID } from './map-style';
import {
  INITIAL_VIEW_STATE,
  toMapJumpOptions,
  toSerializableViewState,
  type ViewStateSerializable,
} from './view-state';

export type MapRendererStatus =
  | 'checking'
  | 'loading'
  | 'ready'
  | 'terrain-fallback'
  | 'context-lost'
  | 'unsupported';

export interface MapLibreDeckRendererOptions {
  container: HTMLElement;
  basePath: string;
  onStatusChange(status: MapRendererStatus): void;
  onViewStateChange(viewState: ViewStateSerializable): void;
}

export class MapLibreDeckRenderer {
  #map: Map | null = null;
  #overlay: MapboxOverlay | null = null;
  #options: MapLibreDeckRendererOptions | null = null;
  #terrainEnabled = true;

  mount(options: MapLibreDeckRendererOptions): void {
    if (this.#map !== null) {
      throw new Error('MapLibreDeckRenderer is already mounted.');
    }

    this.#options = options;
    this.#terrainEnabled = true;

    const map = new maplibregl.Map({
      container: options.container,
      style: createRailway3DMapStyle(options.basePath),
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom,
      pitch: INITIAL_VIEW_STATE.pitch,
      bearing: INITIAL_VIEW_STATE.bearing,
      attributionControl: false,
      canvasContextAttributes: {
        antialias: true,
        contextType: 'webgl2',
      },
      maxPitch: 75,
    });

    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [],
    });

    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(
      new AttributionControl({
        compact: false,
        customAttribution: 'Synthetic Railway3D terrain fixture',
      }),
      'bottom-right',
    );
    map.addControl(overlay);

    map.on('load', this.#handleLoad);
    map.on('moveend', this.#handleMoveEnd);
    map.on('resize', this.#handleMoveEnd);
    map.on('error', this.#handleMapError);
    map.on('webglcontextlost', this.#handleContextLost);
    map.on('webglcontextrestored', this.#handleContextRestored);

    this.#map = map;
    this.#overlay = overlay;
  }

  flyToInitialView(options: { reducedMotion: boolean }): void {
    const map = this.#map;
    if (map === null) {
      return;
    }

    const jumpOptions = toMapJumpOptions(INITIAL_VIEW_STATE);
    if (options.reducedMotion) {
      map.jumpTo(jumpOptions);
      this.#emitViewState();
      return;
    }

    map.flyTo({
      ...jumpOptions,
      duration: 700,
      essential: false,
    });
  }

  resize(): void {
    this.#map?.resize();
    this.#emitViewState();
  }

  destroy(): void {
    const map = this.#map;
    if (map === null) {
      return;
    }

    map.off('load', this.#handleLoad);
    map.off('moveend', this.#handleMoveEnd);
    map.off('resize', this.#handleMoveEnd);
    map.off('error', this.#handleMapError);
    map.off('webglcontextlost', this.#handleContextLost);
    map.off('webglcontextrestored', this.#handleContextRestored);

    if (this.#overlay !== null) {
      this.#removeOverlay(map, this.#overlay);
    }

    map.remove();
    this.#map = null;
    this.#overlay = null;
    this.#options = null;
  }

  get isMounted(): boolean {
    return this.#map !== null;
  }

  #handleLoad = () => {
    this.#options?.onStatusChange('ready');
    this.#emitViewState();
  };

  #handleMoveEnd = () => {
    this.#emitViewState();
  };

  #handleMapError = (event: ErrorEvent) => {
    const sourceId = 'sourceId' in event ? event.sourceId : undefined;
    const shouldFallbackFromTerrain =
      this.#terrainEnabled && (sourceId === undefined || sourceId === SYNTHETIC_DEM_SOURCE_ID);

    if (!shouldFallbackFromTerrain) {
      return;
    }

    this.#terrainEnabled = false;
    this.#map?.setTerrain(null);
    this.#options?.onStatusChange('terrain-fallback');
  };

  #handleContextLost = () => {
    this.#options?.onStatusChange('context-lost');
  };

  #handleContextRestored = () => {
    this.#options?.onStatusChange(this.#terrainEnabled ? 'ready' : 'terrain-fallback');
    this.#emitViewState();
  };

  #emitViewState(): void {
    const map = this.#map;
    if (map === null) {
      return;
    }

    this.#options?.onViewStateChange(toSerializableViewState(map));
  }

  #removeOverlay(map: Map, overlay: IControl): void {
    if (!map.hasControl(overlay)) {
      return;
    }

    map.removeControl(overlay);
  }
}
