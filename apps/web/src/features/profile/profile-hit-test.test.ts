import { describe, expect, it } from 'vitest';

import { nearestSampleFromChartX, isHitWithinSampleInterval } from './profile-hit-test';
import { syntheticElevationProfile } from './profile-controller';
import { createProfileScales } from './profile-scales';

const scales = createProfileScales(syntheticElevationProfile.samples, 720, 280, {
  left: 54,
  right: 18,
  top: 18,
  bottom: 46,
});

describe('profile-hit-test', () => {
  it('returns the nearest profile sample within one sample interval', () => {
    const hit = nearestSampleFromChartX(syntheticElevationProfile, scales.x.scale(1240), scales);

    expect(hit.sample.chainageM).toBe(1000);
    expect(hit.errorM).toBeLessThanOrEqual(syntheticElevationProfile.sampleIntervalTargetM);
  });

  it('clamps hit testing to the profile chainage domain', () => {
    expect(nearestSampleFromChartX(syntheticElevationProfile, -999, scales).chainageM).toBe(0);
    expect(nearestSampleFromChartX(syntheticElevationProfile, 9999, scales).chainageM).toBe(3000);
  });

  it('reports cursor error within the configured sample interval', () => {
    expect(isHitWithinSampleInterval(syntheticElevationProfile, 1250)).toBe(true);
  });
});
