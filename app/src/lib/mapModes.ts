import type { TileLayer } from "leaflet";

export type MapModeKey = "dark" | "light" | "sat" | "topo" | "voyager";

export const MAP_MODE_ALIASES: Record<string, MapModeKey> = {
  DARK: "dark",
  GRID: "dark",
  NIGHT: "dark",
  LIGHT: "light",
  DAY: "light",
  SAT: "sat",
  SATSTREAM: "sat",
  IMAGERY: "sat",
  TOPO: "topo",
  TERRAIN: "topo",
  VECTOR: "voyager",
  VOYAGER: "voyager",
};

export function resolveMapModeKey(token: string): MapModeKey | null {
  if (!token) return null;
  const k = token.replace(/[^A-Z0-9]/g, "");
  return MAP_MODE_ALIASES[k] ?? null;
}

export function createBaseLayers(L: typeof import("leaflet")): Record<MapModeKey, TileLayer> {
  return {
    dark: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 20,
    }),
    light: L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 20,
    }),
    sat: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 },
    ),
    topo: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 },
    ),
    voyager: L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 20,
    }),
  };
}
