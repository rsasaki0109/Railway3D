import type { Map } from 'maplibre-gl';

export interface ViewStateSerializable {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export const INITIAL_VIEW_STATE: ViewStateSerializable = {
  longitude: 139.7671,
  latitude: 35.6812,
  zoom: 11.5,
  pitch: 52,
  bearing: -28,
};

function round(value: number, fractionDigits: number): number {
  return Number(value.toFixed(fractionDigits));
}

export function toSerializableViewState(map: Map): ViewStateSerializable {
  const center = map.getCenter();
  return {
    longitude: round(center.lng, 5),
    latitude: round(center.lat, 5),
    zoom: round(map.getZoom(), 2),
    pitch: round(map.getPitch(), 1),
    bearing: round(map.getBearing(), 1),
  };
}

export function toMapJumpOptions(viewState: ViewStateSerializable) {
  const center: [number, number] = [viewState.longitude, viewState.latitude];

  return {
    center,
    zoom: viewState.zoom,
    pitch: viewState.pitch,
    bearing: viewState.bearing,
  };
}

export function formatViewState(viewState: ViewStateSerializable): string {
  return [
    `lng ${viewState.longitude.toFixed(3)}`,
    `lat ${viewState.latitude.toFixed(3)}`,
    `z ${viewState.zoom.toFixed(1)}`,
    `pitch ${viewState.pitch.toFixed(0)}`,
    `bearing ${viewState.bearing.toFixed(0)}`,
  ].join(' · ');
}
