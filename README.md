# TITAN-V

**Terminal-driven geographic intelligence UI** with a Leaflet map, coordinate registry, atmospheric telemetry, and an optional **Node.js API** under `api/` for geocoding, weather, and shared target storage.

---

## Features

- **Map modes:** Five basemaps (Carto dark / light / Voyager, Esri imagery, Esri topo), switchable from the header or via `\MODE`. Last choice is stored in the browser as `titan_v_map_mode`.
- **Coordinate registry:** Geocode a place, add targets, fly to them by index, remove entries. Registry data is persisted in the **API** while the server runs (in-memory store).
- **Terminal:** Protocol autocomplete (`\`), command history (arrow up), and `\HELP` for the full index.
- **Telemetry:** After `\LOCATE` or from `\WEATHER`, temperature and wind are loaded through the API (Open-Meteo on the server).
- **API contract:** OpenAPI 3.1 spec, Swagger UI at `/docs`, JSON spec at `/openapi.json`.
- **Frontend:** React 18 + TypeScript + Vite + Tailwind in `app/` (Leaflet remains imperative on a map container).

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

### 2. Frontend (`app/` — React + Vite)

```bash
cd app
npm install
npm run dev
```

Vite defaults to **http://localhost:5173**. The UI reads the API base from, in order:

1. `import.meta.env.VITE_API_BASE` (set in `app/.env`; see `app/.env.example`)
2. `?api=http://host:port` on the Vite URL (also persisted as `titan_v_api_base` in `localStorage`)
3. **`http://localhost:3000`**

So a typical dev setup is API on **3000** and Vite on **5173** with no extra config.

Preview the production bundle:

```bash
cd app
npm run build
npm run preview
```

The file **`index.html` at the repository root** is only a short pointer to the React app (for anyone opening the repo root in a browser). The real entry is **`app/index.html`** used by Vite.

Run **both** `api` and `app` dev servers for full behaviour (LOAD, delete, weather, ping, protocol sync).

### Auth first (login / register before the map)

If **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** are set in `app/.env`, opening the app at **`#/`** sends you to **`#/login`** until you are signed in. After a successful session, **`#/`** loads the map. With no Supabase env vars, the map loads immediately (local / demo). The login screen is **email + password** only (register and sign in).

Add your production URL under **Supabase → Authentication → URL configuration**. For **register without a confirmation email**, turn off **Confirm email** (or equivalent) on the **Email** provider — the app cannot disable that from code. See **`supabase/README.md`**.

### Phone / iPhone layout

The UI uses **`viewport-fit=cover`**, **safe-area** padding (`.titan-safe`), and touch rules in **`app/src/index.css`**: on phones, crosshairs are hidden, the system cursor returns, and the map uses **grab / grabbing** cursors for panning. You can **Add to Home Screen** from Safari; optional PWA manifest is not included yet.

### Deploying the web app (`app/`)

1. **Build** (Vite bakes `VITE_*` into the bundle at **build time**):

   ```bash
   cd app
   export VITE_API_BASE="https://your-api.example"   # optional; default is localhost in dev only
   export VITE_SUPABASE_URL="https://xxxx.supabase.co"
   export VITE_SUPABASE_ANON_KEY="sb_publishable_…"
   npm ci && npm run build
   ```

   Serve the **`app/dist/`** folder from any static host (nginx, S3+CloudFront, GitHub Pages, etc.). All routes are under **`#/`** (hash router), so the server only needs to serve **`index.html`** for the app root—no special SPA rewrite for `/login`.

2. **Docker** (see **`app/Containerfile`**):

   ```bash
   docker build -f app/Containerfile ./app \
     --build-arg VITE_API_BASE=https://your-api.example \
     --build-arg VITE_SUPABASE_URL=https://xxxx.supabase.co \
     --build-arg VITE_SUPABASE_ANON_KEY=sb_publishable_xxx \
     -t your-registry/titan-v-app:1.0.0
   ```

3. **Kubernetes / OpenShift** — chart **`app/helm/titan-v-app/`**: build and push the image, then `helm upgrade --install` with your `image.repository` / `image.tag` (see table earlier in this README). Inject API URL and Supabase **publishable** key at **image build time** as above; the chart’s `env:` keys do not change a static Vite bundle unless you add a runtime config layer.

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

### Helm (OpenShift / Kubernetes)

Charts live next to each service:

| Chart | Path |
| :--- | :--- |
| API | `api/helm/titan-v-api/` |
| Web UI | `app/helm/titan-v-app/` |

Examples:

```bash
helm template titan-api ./api/helm/titan-v-api --set openshift.route.enabled=true
helm upgrade --install titan-web ./app/helm/titan-v-app -n your-namespace \
  --set image.repository=quay.io/org/titan-v-app --set image.tag=1.0.0 \
  --set openshift.route.enabled=true
```

- **API** chart: `Deployment`, `Service`, optional **OpenShift `Route`**, probes on `/health`. Build the runtime image with `api/Containerfile` (expects `npm run build` in the image build stage).
- **App** chart: nginx (default `nginxinc/nginx-unprivileged`) with a `ConfigMap` server block on port **8080**, optional **Route**. Build with `app/Containerfile` (multi-stage Vite → static files).

Set `image.repository` / `image.tag` to your registry (for example OpenShift internal registry or Quay).

### Releases & commits

- **commitlint** (root `commitlint.config.mjs` + `.husky/commit-msg` + `.github/workflows/commitlint.yml`) validates conventional commits on pull requests. Types include **`feat`**, **`fix`**, **`helm`**, and the usual **`chore`**, **`docs`**, etc.
- **release-please** (`.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json`) bumps **`api`** and **`app`** `package.json` versions and syncs **`api/helm/titan-v-api/Chart.yaml`** and **`app/helm/titan-v-app/Chart.yaml`** (`version` / `appVersion`).
- The workflow runs on pushes to **`main`** only when the pushed commits include **`feat:`**, **`fix:`**, or **`helm:`** (or a **`chore: release`** merge from release-please). See **`CONTRIBUTING.md`**.

Root dev install (optional, for local hooks):

```bash
npm install
```

---

## Technical stack

| Layer | Technology |
| :--- | :--- |
| UI | **React 18**, **TypeScript**, **Vite**, **Tailwind**, Leaflet 1.9 (map init in `app/src/App.tsx`) |
| API | Node 20+, Express, TypeScript, CORS, Swagger UI, Vitest + Supertest |
| Upstream | Nominatim (geocode), Open-Meteo (weather), public raster tile URLs in the browser |

---

## Notes

- **Attribution:** Map tiles are used without on-map attribution in the demo UI; for production, enable Leaflet attribution and comply with each provider’s terms.
- **Crosshair:** Pointer is hidden for the cyber aesthetic; the HUD still shows coordinates when the cursor is over the map.
- **Targets:** The API store is **in-memory**; restarting the API clears the registry unless you add a database later.

---

*LIRAN TULCHINSKI — fucking 2026*
