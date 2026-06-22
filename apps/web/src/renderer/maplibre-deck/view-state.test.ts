import { describe, expect, it } from 'vitest';

import { formatViewState, toMapJumpOptions, type ViewStateSerializable } from './view-state';

describe('map view state adapter', () => {
  const viewState: ViewStateSerializable = {
    longitude: 139.76712,
    latitude: 35.68123,
    zoom: 12.25,
    pitch: 51.5,
    bearing: -28.25,
  };

  it('formats a compact DOM-readable camera state', () => {
    expect(formatViewState(viewState)).toBe(
      'lng 139.767 · lat 35.681 · z 12.3 · pitch 52 · bearing -28',
    );
  });

  it('adapts serializable state to MapLibre camera options', () => {
    expect(toMapJumpOptions(viewState)).toEqual({
      center: [139.76712, 35.68123],
      zoom: 12.25,
      pitch: 51.5,
      bearing: -28.25,
    });
  });
});
