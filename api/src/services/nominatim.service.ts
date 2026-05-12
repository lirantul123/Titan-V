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
