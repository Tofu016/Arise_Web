// Minimal MapLibre style pointing at OpenStreetMap's own raster tiles —
// the free, no-API-key equivalent of the <TileLayer url="https://{s}.tile
// .openstreetmap.org/..."/> every map in this app used under react-leaflet.
// Shared by every map component so the tile source/attribution is only
// declared once.
export const osmRasterStyle = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "osm-tiles", type: "raster", source: "osm", minzoom: 0, maxzoom: 19 }],
};
