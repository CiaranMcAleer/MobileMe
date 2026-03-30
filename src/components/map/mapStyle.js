export const fuelMapStyle = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#ece8dc",
      },
    },
    {
      id: "osm-raster",
      type: "raster",
      source: "osm",
      paint: {
        "raster-opacity": 0.82,
        "raster-saturation": -0.82,
        "raster-contrast": 0.12,
        "raster-brightness-min": 0.28,
        "raster-brightness-max": 0.94,
      },
    },
  ],
};
