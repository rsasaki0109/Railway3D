import { describe, expect, it } from 'vitest';

import { toRenderElevation } from './elevation';

describe('railway render elevation', () => {
  it('applies vertical exaggeration without changing the source value', () => {
    expect(toRenderElevation(12, 1)).toBe(12);
    expect(toRenderElevation(12, 3)).toBe(36);
    expect(toRenderElevation(-8, 5)).toBe(-40);
  });
});
