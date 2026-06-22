import { describe, expect, it } from 'vitest';

import { getWebGL2Support } from './webgl-support';

describe('WebGL2 support detector', () => {
  it('accepts a browser that can create a WebGL2 context', () => {
    const documentRef = {
      createElement: () => ({
        getContext: (kind: string) => (kind === 'webgl2' ? {} : null),
      }),
    } as Document;

    expect(getWebGL2Support(documentRef)).toEqual({ supported: true });
  });

  it('reports unsupported browsers without throwing', () => {
    const documentRef = {
      createElement: () => ({
        getContext: () => null,
      }),
    } as Document;

    expect(getWebGL2Support(documentRef)).toEqual({
      supported: false,
      reason: 'webgl2-unavailable',
    });
  });
});
