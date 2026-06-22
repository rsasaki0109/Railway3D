import { describe, expect, it } from 'vitest';

import {
  createRailway3DMapStyle,
  createSyntheticTerrainTileUrl,
  SYNTHETIC_DEM_SOURCE_ID,
} from './map-style';

describe('Railway3D MapLibre style', () => {
  it('resolves synthetic terrain under the Vite base path', () => {
    expect(createSyntheticTerrainTileUrl('/Railway3D/')).toBe(
      '/Railway3D/terrain/demo/{z}/{x}/{y}.png',
    );
  });

  it('uses only a same-origin synthetic terrain source', () => {
    const style = createRailway3DMapStyle('/');
    const source = style.sources[SYNTHETIC_DEM_SOURCE_ID];

    expect(source).toMatchObject({
      type: 'raster-dem',
      tiles: ['/terrain/demo/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
    });
    expect(JSON.stringify(style)).not.toContain('https://');
  });
});
