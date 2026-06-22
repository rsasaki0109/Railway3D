import { describe, expect, it } from 'vitest';

import { getBuildStatusText } from './App';

describe('Railway3D bootstrap app', () => {
  it('identifies the page as a development build', () => {
    expect(getBuildStatusText()).toBe('Railway3D development build');
  });
});
