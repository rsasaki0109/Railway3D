import { describe, expect, it } from 'vitest';

import { SYNTHETIC_LINE_ID } from '../../renderer/railway/synthetic-render-dataset';
import {
  DEFAULT_PROFILE_CURSOR_CHAINAGE_M,
  findNearestProfileSample,
  fitProfileRangeToView,
  loadSyntheticProfileForSelection,
  splitRailSegments,
  stepProfileCursor,
  syntheticElevationProfile,
} from './profile-controller';

describe('profile-controller', () => {
  it('keeps rail line gaps where rail elevation is null', () => {
    const segments = splitRailSegments(syntheticElevationProfile.samples);

    expect(segments).toHaveLength(2);
    expect(segments[0]?.samples.map((sample) => sample.chainageM)).toEqual([0, 500, 1000, 1500]);
    expect(segments[1]?.samples.map((sample) => sample.chainageM)).toEqual([2500, 3000]);
  });

  it('preserves the portal and station marker chainages', () => {
    expect(syntheticElevationProfile.markers).toEqual([
      { chainageM: 0, label: 'Station A', kind: 'station' },
      { chainageM: 1000, label: 'Portal', kind: 'portal' },
      { chainageM: 3000, label: 'Station C', kind: 'station' },
    ]);
  });

  it('loads only the synthetic line profile', async () => {
    await expect(
      loadSyntheticProfileForSelection({ kind: 'line', id: SYNTHETIC_LINE_ID }),
    ).resolves.toBe(syntheticElevationProfile);
    await expect(
      loadSyntheticProfileForSelection({ kind: 'station', id: 'r3d:zz:synthetic:station:A' }),
    ).rejects.toThrow('Golden Fixture Line');
  });

  it('steps the cursor by sample without inventing values inside the null gap', () => {
    expect(stepProfileCursor(syntheticElevationProfile, DEFAULT_PROFILE_CURSOR_CHAINAGE_M, 1)).toBe(
      1500,
    );
    expect(stepProfileCursor(syntheticElevationProfile, 1500, 1)).toBe(2000);
    expect(findNearestProfileSample(syntheticElevationProfile, 2000).railElevationM).toBeNull();
  });

  it('fits a profile brush range to a deterministic map view', () => {
    expect(fitProfileRangeToView(syntheticElevationProfile, [1000, 2500])).toEqual({
      longitude: 139.76625,
      latitude: 35.68325,
      zoom: 12.7,
      pitch: 55,
      bearing: -28,
    });
  });
});
