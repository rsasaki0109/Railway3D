import type { StyleSpecification } from 'maplibre-gl';

export const SYNTHETIC_DEM_SOURCE_ID = 'railway3d-synthetic-dem';
export const SYNTHETIC_HILLSHADE_SOURCE_ID = 'railway3d-synthetic-hillshade-dem';
export const SYNTHETIC_GUIDE_SOURCE_ID = 'railway3d-synthetic-guide-grid';

function withTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

export function createSyntheticTerrainTileUrl(basePath: string): string {
  return `${withTrailingSlash(basePath)}terrain/demo/{z}/{x}/{y}.png`;
}

export function createRailway3DMapStyle(basePath: string): StyleSpecification {
  const syntheticTerrainTileUrl = createSyntheticTerrainTileUrl(basePath);

  return {
    version: 8,
    name: 'Railway3D synthetic terrain shell',
    sources: {
      [SYNTHETIC_DEM_SOURCE_ID]: {
        type: 'raster-dem',
        tiles: [syntheticTerrainTileUrl],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 0,
        encoding: 'terrarium',
        attribution: 'Synthetic terrain fixture',
      },
      [SYNTHETIC_HILLSHADE_SOURCE_ID]: {
        type: 'raster-dem',
        tiles: [syntheticTerrainTileUrl],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 0,
        encoding: 'terrarium',
        attribution: 'Synthetic terrain fixture',
      },
      [SYNTHETIC_GUIDE_SOURCE_ID]: {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [139.55, 35.55],
                    [139.98, 35.55],
                    [139.98, 35.84],
                    [139.55, 35.84],
                    [139.55, 35.55],
                  ],
                ],
              },
            },
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'MultiLineString',
                coordinates: [
                  [
                    [139.55, 35.6],
                    [139.98, 35.6],
                  ],
                  [
                    [139.55, 35.68],
                    [139.98, 35.68],
                  ],
                  [
                    [139.55, 35.76],
                    [139.98, 35.76],
                  ],
                  [
                    [139.64, 35.55],
                    [139.64, 35.84],
                  ],
                  [
                    [139.76, 35.55],
                    [139.76, 35.84],
                  ],
                  [
                    [139.88, 35.55],
                    [139.88, 35.84],
                  ],
                  [
                    [139.57, 35.57],
                    [139.96, 35.82],
                  ],
                ],
              },
            },
          ],
        },
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#e7ecef',
        },
      },
      {
        id: 'synthetic-terrain-hillshade',
        type: 'hillshade',
        source: SYNTHETIC_HILLSHADE_SOURCE_ID,
        paint: {
          'hillshade-accent-color': '#8aa09a',
          'hillshade-highlight-color': '#f5faf8',
          'hillshade-shadow-color': '#4d625b',
        },
      },
      {
        id: 'synthetic-guide-fill',
        type: 'fill',
        source: SYNTHETIC_GUIDE_SOURCE_ID,
        paint: {
          'fill-color': '#a8c8bf',
          'fill-opacity': 0.18,
        },
        filter: ['==', '$type', 'Polygon'],
      },
      {
        id: 'synthetic-guide-lines',
        type: 'line',
        source: SYNTHETIC_GUIDE_SOURCE_ID,
        paint: {
          'line-color': '#42665c',
          'line-opacity': 0.68,
          'line-width': 2,
        },
        filter: ['==', '$type', 'LineString'],
      },
    ],
    terrain: {
      source: SYNTHETIC_DEM_SOURCE_ID,
      exaggeration: 1,
    },
  };
}
