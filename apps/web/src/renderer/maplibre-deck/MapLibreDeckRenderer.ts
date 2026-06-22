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
import { buildRailwayLayers } from '../railway/layer-factory';
import {
  SYNTHETIC_LINE_ID,
  resolveSyntheticProfileCursor,
  syntheticRenderDataset,
} from '../railway/synthetic-render-dataset';
import type { Selection, VisualizationState } from '../railway/render-types';

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
  initialViewState: ViewStateSerializable;
  onStatusChange(status: MapRendererStatus): void;
  onViewStateChange(viewState: ViewStateSerializable): void;
  onSelectionChange(selection: Selection): void;
}

function viewStatesEqual(left: ViewStateSerializable, right: ViewStateSerializable): boolean {
  return (
    left.longitude === right.longitude &&
    left.latitude === right.latitude &&
    left.zoom === right.zoom &&
    left.pitch === right.pitch &&
    left.bearing === right.bearing
  );
}

export class MapLibreDeckRenderer {
  #map: Map | null = null;
  #overlay: MapboxOverlay | null = null;
  #options: MapLibreDeckRendererOptions | null = null;
  #terrainEnabled = true;
  #styleLoaded = false;
  #visualization: VisualizationState = {
    colorMode: 'line',
    xrayMode: 'selected',
    verticalExaggeration: 1,
    stationVisible: true,
    labelVisible: true,
    guideVisible: true,
    uncertaintyVisible: true,
  };
  #selection: Selection = { kind: 'line', id: SYNTHETIC_LINE_ID };
  #hovered: Selection = null;
  #profileCursorChainageM: number | null = null;

  mount(options: MapLibreDeckRendererOptions): void {
    if (this.#map !== null) {
      throw new Error('MapLibreDeckRenderer is already mounted.');
    }

    this.#options = options;
    this.#terrainEnabled = true;
    this.#styleLoaded = false;

    const map = new maplibregl.Map({
      container: options.container,
      style: createRailway3DMapStyle(options.basePath),
      center: [options.initialViewState.longitude, options.initialViewState.latitude],
      zoom: options.initialViewState.zoom,
      pitch: options.initialViewState.pitch,
      bearing: options.initialViewState.bearing,
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
    this.#syncLayers();
  }

  setVisualization(visualization: VisualizationState): void {
    this.#visualization = visualization;
    this.#setTerrainExaggeration();
    this.#syncLayers();
  }

  setSelection(selection: Selection): void {
    this.#selection = selection;
    this.#syncLayers();
  }

  setProfileCursorChainageM(chainageM: number | null): void {
    this.#profileCursorChainageM = chainageM;
    this.#syncLayers();
  }

  setViewState(viewState: ViewStateSerializable): void {
    const map = this.#map;
    if (map === null) {
      return;
    }

    if (viewStatesEqual(toSerializableViewState(map), viewState)) {
      return;
    }

    map.jumpTo(toMapJumpOptions(viewState));
    this.#emitViewState();
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
    this.#styleLoaded = false;
  }

  get isMounted(): boolean {
    return this.#map !== null;
  }

  #handleLoad = () => {
    this.#styleLoaded = true;
    this.#setTerrainExaggeration();
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
    this.#styleLoaded = this.#map?.isStyleLoaded() === true;
    this.#setTerrainExaggeration();
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

  #setTerrainExaggeration(): void {
    const map = this.#map;
    if (!this.#terrainEnabled || map === null || !this.#styleLoaded) {
      return;
    }

    map.setTerrain({
      source: SYNTHETIC_DEM_SOURCE_ID,
      exaggeration: this.#visualization.verticalExaggeration,
    });
  }

  #syncLayers(): void {
    this.#overlay?.setProps({
      layers: buildRailwayLayers({
        dataset: syntheticRenderDataset,
        visualization: this.#visualization,
        selection: this.#selection,
        hovered: this.#hovered,
        profileCursor: resolveSyntheticProfileCursor(
          this.#profileCursorChainageM,
          this.#visualization.verticalExaggeration,
        ),
        callbacks: {
          onHover: (selection) => {
            this.#hovered = selection;
          },
          onSelect: (selection) => {
            this.#selection = selection;
            this.#options?.onSelectionChange(selection);
            this.#syncLayers();
          },
        },
      }),
    });
  }
}
