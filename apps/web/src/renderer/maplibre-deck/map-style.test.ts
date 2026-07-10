import { describe, expect, it } from 'vitest';

import { createRailway3DMapStyle, GSI_PALE_SOURCE_ID, GSI_PALE_TILE_URL } from './map-style';

describe('Railway3D MapLibre style', () => {
  it('uses GSI pale tiles as the Tokyo basemap', () => {
    const style = createRailway3DMapStyle('/Railway3D/');
    const source = style.sources[GSI_PALE_SOURCE_ID];

    expect(source).toMatchObject({
      type: 'raster',
      tiles: [GSI_PALE_TILE_URL],
      tileSize: 256,
    });
    expect(style.layers.some((layer) => layer.id === 'gsi-pale')).toBe(true);
  });

  it('attributes 国土地理院 for basemap tiles', () => {
    const style = createRailway3DMapStyle('/');
    expect(JSON.stringify(style)).toContain('国土地理院');
    expect(JSON.stringify(style)).toContain('cyberjapandata.gsi.go.jp');
  });
});
