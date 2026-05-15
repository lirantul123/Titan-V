import type { TileLayer } from "leaflet";

export type MapModeKey = "map" | "satellite";

export const MAP_MODE_ALIASES: Record<string, MapModeKey> = {
  MAP: "map",
  ROAD: "map",
  STANDARD: "map",
  STREET: "map",
  OSM: "map",
  LIGHT: "map",
  DAY: "map",
  DARK: "map",
  GRID: "map",
  NIGHT: "map",
  TOPO: "map",
  TERRAIN: "map",
  VECTOR: "map",
  VOYAGER: "map",
  SAT: "satellite",
  SATELLITE: "satellite",
  SATSTREAM: "satellite",
  IMAGERY: "satellite",
};

export function normalizeStoredMapMode(stored: string | null): MapModeKey {
  if (stored === "satellite" || stored === "sat") return "satellite";
  return "map";
}

export function resolveMapModeKey(token: string): MapModeKey | null {
  if (!token) return null;
  const k = token.replace(/[^A-Z0-9]/g, "");
  return MAP_MODE_ALIASES[k] ?? null;
}

export function createBaseLayers(L: typeof import("leaflet")): Record<MapModeKey, TileLayer> {
  return {
    map: L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 20,
    }),
    satellite: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 },
    ),
  };
}
