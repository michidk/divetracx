import type { StyleSpecification } from 'maplibre-gl'

export const DIVE_SITE_BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    diveSiteBasemap: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 20,
      attribution: '© OpenStreetMap contributors, © CARTO',
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
