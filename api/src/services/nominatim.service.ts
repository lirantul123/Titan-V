export type GeocodeHit = {
  lat: number;
  lon: number;
  displayName: string;
};

type NominatimRow = {
  lat: string;
  lon: string;
  display_name: string;
};

const USER_AGENT = "Titan-V/1.0 (https://github.com/titan-v; geocode@local)";

export async function searchNominatim(q: string): Promise<GeocodeHit[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", "5");

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`NOMINATIM_HTTP_${res.status}`);
  }

  const data = (await res.json()) as NominatimRow[];
  if (!Array.isArray(data)) return [];

  return data
    .map((row) => ({
      lat: Number(row.lat),
      lon: Number(row.lon),
      displayName: row.display_name,
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
}

type NominatimReverseRow = {
  lat: string;
  lon: string;
  display_name: string;
};

export async function reverseNominatim(lat: number, lon: number): Promise<GeocodeHit | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("zoom", "14");

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!res.ok) throw new Error(`NOMINATIM_HTTP_${res.status}`);

  const row = (await res.json()) as NominatimReverseRow;
  if (!row?.display_name) return null;

  const rLat = Number(row.lat);
  const rLon = Number(row.lon);
  if (!Number.isFinite(rLat) || !Number.isFinite(rLon)) return null;

  return { lat: rLat, lon: rLon, displayName: row.display_name };
}
