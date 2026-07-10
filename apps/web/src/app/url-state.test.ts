import { describe, expect, it } from 'vitest';

import { createAppState } from './app-state';
import { clampViewState, parseUrlState, serializeUrlState } from './url-state';

describe('url-state', () => {
  it('clamps unsafe camera values and falls back for unsupported params', () => {
    const parsed = parseUrlState('#/@999,999,99,99,999?mode=bad&xray=bad&vex=99&line=bad');

    expect(parsed.view).toEqual({
      latitude: 85,
      longitude: 180,
      zoom: 22,
      pitch: 75,
      bearing: 180,
    });
    expect(parsed.visualization.colorMode).toBe('line');
    expect(parsed.visualization.xrayMode).toBe('selected');
    expect(parsed.visualization.verticalExaggeration).toBe(1);
    expect(parsed.selection).toEqual({ kind: 'line', id: 'r3d:jp:tokyometro:line:ginza' });
  });

  it('round trips line selection and visualization state', () => {
    const state = createAppState({
      view: {
        latitude: 35.68123,
        longitude: 139.76712,
        zoom: 12.34,
        pitch: 45.6,
        bearing: -12.3,
      },
      visualization: {
        colorMode: 'confidence',
        xrayMode: 'all-underground',
        verticalExaggeration: 3,
        stationVisible: false,
        labelVisible: true,
        guideVisible: false,
        uncertaintyVisible: false,
      },
      selection: { kind: 'line', id: 'r3d:jp:tokyometro:line:ginza' },
      profileCursorChainageM: 1234.56,
    });

    const hash = serializeUrlState(state);
    expect(hash).toContain('xray=all');
    expect(hash).toContain('mode=confidence');
    expect(hash).toContain('stations=0');
    expect(hash).toContain('guides=0');
    expect(hash).toContain('uncertainty=0');
    expect(hash).toContain('profile=1234.6');
    expect(parseUrlState(hash).visualization).toEqual(state.visualization);
    expect(parseUrlState(hash).selection).toEqual(state.selection);
    expect(parseUrlState(hash).profileCursorChainageM).toBe(1234.6);
  });

  it('serializes station selection without leaking hover state', () => {
    const state = createAppState({
      selection: { kind: 'station', id: 'r3d:jp:tokyometro:station:ginza-ueno' },
      hovered: { kind: 'station', id: 'r3d:jp:tokyometro:station:ginza-shibuya' },
    });

    const hash = serializeUrlState(state);
    expect(hash).toContain('station=r3d%3Ajp%3Atokyometro%3Astation%3Aginza-ueno');
    expect(hash).not.toContain('hover');
    expect(hash).not.toContain('shibuya');
  });

  it('clamps invalid profile cursor state', () => {
    expect(parseUrlState('#/@35,139,12,45,0?profile=2000000').profileCursorChainageM).toBe(1000000);
    expect(parseUrlState('#/@35,139,12,45,0?profile=bad').profileCursorChainageM).toBeNull();
  });

  it('clamps view state as a pure function', () => {
    expect(
      clampViewState({
        latitude: -100,
        longitude: -200,
        zoom: -1,
        pitch: -20,
        bearing: 300,
      }),
    ).toEqual({
      latitude: -85,
      longitude: -180,
      zoom: 0,
      pitch: 0,
      bearing: 180,
    });
  });
});
