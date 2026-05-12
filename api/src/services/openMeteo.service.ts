export type CurrentWeather = {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode: number;
  time: string;
};

type OpenMeteoResponse = {
  current_weather?: CurrentWeather;
};

export async function fetchCurrentWeather(
  lat: number,
  lon: number,
): Promise<CurrentWeather | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current_weather", "true");

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`OPEN_METEO_HTTP_${res.status}`);

  const data = (await res.json()) as OpenMeteoResponse;
  return data.current_weather ?? null;
}
