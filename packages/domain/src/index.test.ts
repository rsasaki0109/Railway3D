import { describe, expect, it } from 'vitest';

import {
  deriveClearance,
  deriveDepth,
  deriveHeightAboveGround,
  gradientPermille,
  isRailway3dEntityId,
} from './index';

describe('isRailway3dEntityId', () => {
  it('accepts the Railway3D stable ID prefix shape', () => {
    expect(isRailway3dEntityId('r3d:jp:sample:line:A')).toBe(true);
    expect(isRailway3dEntityId('sample:line:A')).toBe(false);
  });
});

describe('elevation derived values', () => {
  it('preserves null instead of converting unknown values to zero', () => {
    expect(deriveClearance(null, 12)).toBeNull();
    expect(deriveClearance(12, null)).toBeNull();
    expect(deriveDepth(null)).toBeNull();
    expect(deriveHeightAboveGround(null)).toBeNull();
  });

  it('derives clearance, depth, height, and gradient from finite inputs', () => {
    expect(deriveClearance(-8, 12)).toBe(-20);
    expect(deriveDepth(-20)).toBe(20);
    expect(deriveDepth(5)).toBe(0);
    expect(deriveHeightAboveGround(5)).toBe(5);
    expect(deriveHeightAboveGround(-20)).toBe(0);
    expect(gradientPermille(3, 100)).toBe(30);
    expect(gradientPermille(3, 0)).toBeNull();
  });
});
