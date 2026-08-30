import type { StyleSpecification } from 'maplibre-gl'

export const DIVE_SITE_BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    diveSiteBasemap: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'diveSiteBasemap',
      type: 'raster',
      source: 'diveSiteBasemap',
      paint: {
        'raster-saturation': -0.35,
        'raster-contrast': -0.04,
      },
    },
  ],
}
