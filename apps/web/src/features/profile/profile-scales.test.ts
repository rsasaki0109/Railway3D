import { describe, expect, it } from 'vitest';

import { syntheticElevationProfile } from './profile-controller';
import { createLinearScale, createProfileScales } from './profile-scales';

describe('profile-scales', () => {
  it('maps and inverts linear scale values', () => {
    const scale = createLinearScale([0, 100], [10, 210]);

    expect(scale.scale(50)).toBe(110);
    expect(scale.invert(110)).toBe(50);
    expect(scale.clamp(-10)).toBe(0);
    expect(scale.clamp(110)).toBe(100);
  });

  it('builds profile domains without treating null rail elevation as zero', () => {
    const scales = createProfileScales(syntheticElevationProfile.samples, 720, 280, {
      left: 54,
      right: 18,
      top: 18,
      bottom: 46,
    });

    expect(scales.x.domain).toEqual([0, 3000]);
    expect(scales.y.domain[0]).toBeLessThan(-18);
    expect(scales.y.domain[1]).toBeGreaterThan(22);
  });
});
