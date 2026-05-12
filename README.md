# TITAN-V

**Terminal-driven geographic intelligence UI** with a Leaflet map, coordinate registry, atmospheric telemetry, and an optional **Node.js API** under `api/` for geocoding, weather, and shared target storage.

---

## Features

- **Map modes:** Five basemaps (Carto dark / light / Voyager, Esri imagery, Esri topo), switchable from the header or via `\MODE`. Last choice is stored in the browser as `titan_v_map_mode`.
- **Coordinate registry:** Geocode a place, add targets, fly to them by index, remove entries. Registry data is persisted in the **API** while the server runs (in-memory store).
- **Terminal:** Protocol autocomplete (`\`), command history (arrow up), and `\HELP` for the full index.
- **Telemetry:** After `\LOCATE` or from `\WEATHER`, temperature and wind are loaded through the API (Open-Meteo on the server).
- **API contract:** OpenAPI 3.1 spec, Swagger UI at `/docs`, JSON spec at `/openapi.json`.

---

## Quick start

### 1. Backend (`api/`)

```bash
cd api
npm install
npm run dev
```

Default URL: **http://localhost:3000**

- **Swagger UI:** http://localhost:3000/docs  
- **OpenAPI JSON:** http://localhost:3000/openapi.json  
- **Health:** http://localhost:3000/health  

Production-style run: `npm run build && npm start`

### 2. Frontend (static `index.html`)

Serve the **repository root** (where `index.html` lives), not only the `api/` folder:

```bash
cd /path/to/Titan-V
npx serve . -p 5173
```

Open **http://localhost:5173** (or the port your tool prints).

The UI defaults to `http://localhost:3000` as the API base. If the API runs elsewhere:

- One-time query (also saved to `localStorage` as `titan_v_api_base`):  
  `http://localhost:5173/?api=http://127.0.0.1:3000`
- Or set `titan_v_api_base` in the browser for your API origin (no trailing slash).

Run **both** terminals (API + static server) for full behaviour (LOAD, delete, weather, ping, protocol sync).

---

## Command protocols

Enter commands in the bottom-right terminal. Prefix with `\` (autocomplete lists commands from the API after a successful sync, otherwise from the built-in list).

| Protocol | Arguments | Description |
| :--- | :--- | :--- |
| `\MODE` | `DARK` \| `LIGHT` \| `SAT` \| `TOPO` \| `VECTOR` | Switches basemap (aliases: `GRID`, `DAY`, `SAT_STREAM`, `TERRAIN`, `VOYAGER`). |
| `\LOCATE` | `[index]` | Flies to the registry row with that index (e.g. `\LOCATE 1`). |
| `\WEATHER` | `[index]` | Logs current weather for that target via the API. |
| `\ADD` | `<query>` | Geocodes and creates a target (same flow as LOAD). |
| `\GEOCODE` | `<query>` | Runs geocode only; logs top hit (does not add a target). |
| `\SCAN` | — | Fetches targets from the API and logs uplink lines. |
| `\SYNC` | — | Reloads protocols and targets from the API. |
| `\PING` | — | Calls `/api/v1/system/ping` and logs round-trip timing. |
| `\HEALTH` | — | Calls `GET /health`. |
| `\DOCS` | — | Opens Swagger UI in a new tab. |
| `\API` | — | Logs API base, OpenAPI URL, and docs URL. |
| `\CLEAR` | — | Clears the terminal log. |
| `\HELP` | — | Prints the protocol index. |

**Sidebar:** `LOC_QUERY` + **LOAD** uses `POST /api/v1/geocode` then `POST /api/v1/targets`. Deleting a row calls `DELETE /api/v1/targets/:id`.

---

## API overview (`/api/v1`)

| Method | Path | Role |
| :--- | :--- | :--- |
| `GET` | `/health` | Liveness JSON. |
| `GET` | `/api/v1/protocols` | Terminal command list for UI sync. |
| `GET` | `/api/v1/system/ping` | Server time; UI uses it for header latency. |
| `POST` | `/api/v1/geocode` | Body `{ "q": "..." }` — forwards to Nominatim with a proper `User-Agent`. |
| `GET` | `/api/v1/weather?lat=&lon=` | Proxies Open-Meteo `current_weather`. |
| `GET` | `/api/v1/targets` | Lists targets. |
| `POST` | `/api/v1/targets` | Body `{ "name", "lat", "lon" }` — creates a target. |
| `DELETE` | `/api/v1/targets/:id` | Removes a target. |

Details and schemas: `api/openapi/openapi.yaml`.

### Tests

```bash
cd api
npm test
```

---

## Technical stack

| Layer | Technology |
| :--- | :--- |
| UI | HTML, Leaflet 1.9, Tailwind CDN, crosshair + glass layout |
| API | Node 20+, Express, TypeScript, CORS, Swagger UI, Vitest + Supertest |
| Upstream | Nominatim (geocode), Open-Meteo (weather), public raster tile URLs in the browser |

---

## Notes

- **Attribution:** Map tiles are used without on-map attribution in the demo UI; for production, enable Leaflet attribution and comply with each provider’s terms.
- **Crosshair:** Pointer is hidden for the cyber aesthetic; the HUD still shows coordinates when the cursor is over the map.
- **Targets:** The API store is **in-memory**; restarting the API clears the registry unless you add a database later.

---

*LIRAN TULCHINSKI — 2026*
