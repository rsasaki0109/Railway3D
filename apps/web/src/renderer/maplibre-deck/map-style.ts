import type { StyleSpecification } from 'maplibre-gl';

export const GSI_PALE_SOURCE_ID = 'railway3d-gsi-pale';
export const GSI_STANDARD_SOURCE_ID = 'railway3d-gsi-std';

/** 国土地理院 地理院タイル (pale) — free public basemap for Japan. */
export const GSI_PALE_TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';
export const GSI_STANDARD_TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';

export const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>';

export function createRailway3DMapStyle(basePath: string): StyleSpecification {
  // basePath is reserved for same-origin assets; Tokyo pilot basemap is GSI remote tiles.
  void basePath;
  return {
    version: 8,
    name: 'Railway3D Tokyo Metro pilot',
    sources: {
      [GSI_PALE_SOURCE_ID]: {
        type: 'raster',
        tiles: [GSI_PALE_TILE_URL],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 18,
        attribution: GSI_ATTRIBUTION,
      },
      [GSI_STANDARD_SOURCE_ID]: {
        type: 'raster',
        tiles: [GSI_STANDARD_TILE_URL],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 18,
        attribution: GSI_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#dfe7ea',
        },
      },
      {
        id: 'gsi-pale',
        type: 'raster',
        source: GSI_PALE_SOURCE_ID,
        paint: {
          'raster-opacity': 1,
          'raster-saturation': -0.15,
        },
      },
    ],
  };
}
