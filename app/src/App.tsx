import type { CircleMarker, Map as LeafletMap } from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthPanel } from "./components/AuthPanel";
import { useAuth } from "./context/AuthContext";
import { getApiBase } from "./lib/apiBase";
import { DEFAULT_PROTOCOLS } from "./lib/defaultProtocols";
import { createBaseLayers, resolveMapModeKey, type MapModeKey } from "./lib/mapModes";
import { findDuplicateTarget } from "./lib/targetDedupe";
import type { LogLine, LogStatus, Protocol, Target } from "./lib/types";

function timeLabel(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

const MAX_LOG_LINES = 400;

/** Normalize command text so palette matches whether API sends `\MODE` or `MODE`. */
function protocolPaletteKey(cmd: string): string {
  const t = cmd.trim().toUpperCase();
  return t.startsWith("\\") ? t : `\\${t}`;
}

/** True if this code point starts a slash-command (ASCII \\, /, fullwidth \\). */
function isCommandLeaderCodePoint(cp: number | undefined): cp is number {
  if (cp === undefined) return false;
  return cp === 0x5c || cp === 0x2f || cp === 0xff3c;
}

/** Normalize whether the user started a command; builds match prefix for filtering. */
function stripCommandLeader(raw: string): { active: boolean; matchPrefix: string } {
  const t = raw.trimStart();
  const c0 = t.codePointAt(0);
  if (!isCommandLeaderCodePoint(c0)) return { active: false, matchPrefix: "" };
  const leaderLen = c0 > 0xffff ? 2 : 1;
  const rest = t.slice(leaderLen).toUpperCase();
  return { active: true, matchPrefix: `\\${rest}` };
}

export default function App() {
  const { apiFetch, authReady, supabaseEnabled, session } = useAuth();
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const sessionAccessTokenRef = useRef<string | undefined>(undefined);
  sessionAccessTokenRef.current = session?.access_token;

  const apiBase = useRef(getApiBase());
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletLibRef = useRef<typeof import("leaflet") | null>(null);
  const layersRef = useRef<ReturnType<typeof createBaseLayers> | null>(null);
  const markersRef = useRef<CircleMarker[]>([]);

  const [mapReady, setMapReady] = useState(false);
  const [targets, setTargets] = useState<Target[]>([]);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const [protocols, setProtocols] = useState<Protocol[]>(DEFAULT_PROTOCOLS);
  const protocolsRef = useRef(protocols);
  protocolsRef.current = protocols;

  const [mapMode, setMapMode] = useState<MapModeKey>(() => {
    try {
      const s = localStorage.getItem("titan_v_map_mode") as MapModeKey | null;
      if (s && ["dark", "light", "sat", "topo", "voyager"].includes(s)) return s;
    } catch {
      /* ignore */
    }
    return "dark";
  });

  const [logLines, setLogLines] = useState<LogLine[]>([
    { id: "boot", time: timeLabel(), text: ">> SYSTEM_READY", status: "cmd" },
  ]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const prevPaletteOpenRef = useRef(false);

  const [intelVisible, setIntelVisible] = useState(false);
  const [intelName, setIntelName] = useState("---");
  const [intelCoords, setIntelCoords] = useState("0.00, 0.00");
  const [intelTemp, setIntelTemp] = useState("--°C");
  const [intelWind, setIntelWind] = useState("--KM/H");

  const [coordHud, setCoordHud] = useState("0.0000 | 0.0000");
  const [clock, setClock] = useState("00:00:00");
  const [ping, setPing] = useState("LATENCY: --");

  const [searchQuery, setSearchQuery] = useState("");
  const [terminalInput, setTerminalInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyDraftRef = useRef("");
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [suppressCmdPalette, setSuppressCmdPalette] = useState(false);
  const [terminalCollapsed, setTerminalCollapsed] = useState(() => {
    try {
      return localStorage.getItem("titan_v_terminal_collapsed") === "1";
    } catch {
      return false;
    }
  });

  const [cross, setCross] = useState({ x: 0, y: 0 });

  const writeLog = useCallback((text: string, status: LogStatus = "default") => {
    setLogLines((prev) => {
      const next = [...prev, { id: crypto.randomUUID(), time: timeLabel(), text, status }];
      return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
    });
  }, []);

  useEffect(() => {
    const scrollEl = logScrollRef.current;
    if (!scrollEl) return;
    const distanceFromBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    if (distanceFromBottom > 120) return;
    requestAnimationFrame(() => {
      logEndRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
    });
  }, [logLines]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("titan_v_terminal_collapsed", terminalCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [terminalCollapsed]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const id = window.setTimeout(() => {
      mapRef.current?.invalidateSize({ animate: false });
    }, 100);
    return () => window.clearTimeout(id);
  }, [terminalCollapsed, mapReady]);

  const refreshPing = useCallback(async () => {
    const t0 = performance.now();
    try {
      const r = await apiFetch(`${apiBase.current}/api/v1/system/ping`);
      const ms = Math.round(performance.now() - t0);
      setPing(r.ok ? `LATENCY: ${ms}MS` : "LATENCY: ERR");
    } catch {
      setPing("LATENCY: --");
    }
  }, [apiFetch]);

  useEffect(() => {
    void refreshPing();
    const id = window.setInterval(() => void refreshPing(), 4000);
    return () => window.clearInterval(id);
  }, [refreshPing]);

  useEffect(() => {
    const pending = { x: 0, y: 0 };
    let raf = 0;
    const flush = () => {
      raf = 0;
      const el = mapElRef.current;
      const map = mapRef.current;
      const L = leafletLibRef.current;
      setCross({ x: pending.x, y: pending.y });
      if (!el || !map || !L) return;
      const r = el.getBoundingClientRect();
      if (pending.x >= r.left && pending.x <= r.right && pending.y >= r.top && pending.y <= r.bottom) {
        const x = pending.x - r.left;
        const y = pending.y - r.top;
        const ll = map.containerPointToLatLng(L.point(x, y));
        setCoordHud(`${ll.lat.toFixed(4)} | ${ll.lng.toFixed(4)}`);
      }
    };
    const onMove = (e: MouseEvent) => {
      pending.x = e.clientX;
      pending.y = e.clientY;
      if (!raf) raf = requestAnimationFrame(flush);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mapReady]);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    let cancelled = false;
    let map: LeafletMap | null = null;

    void (async () => {
      await import("leaflet/dist/leaflet.css");
      const raw = await import("leaflet");
      const Leaflet = ((raw as unknown as { default?: typeof import("leaflet") }).default ?? raw) as typeof import("leaflet");
      if (cancelled || !mapElRef.current) return;
      leafletLibRef.current = Leaflet;
      map = Leaflet.map(mapElRef.current, { zoomControl: false, attributionControl: false }).setView([20, 0], 2);
      const layers = createBaseLayers(Leaflet);
      layersRef.current = layers;
      mapRef.current = map;
      layers.dark.addTo(map);
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      layersRef.current = null;
      leafletLibRef.current = null;
      markersRef.current = [];
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    Object.values(layers).forEach((layer) => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    layers[mapMode].addTo(map);
  }, [mapMode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletLibRef.current;
    if (!map || !L) return;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = targets.map((t) =>
      L.circleMarker([t.lat, t.lon], { radius: 8, color: "#00f3ff", fillOpacity: 0.4 }).addTo(map),
    );
  }, [targets, mapReady]);

  const setMode = useCallback(
    (mode: MapModeKey, opts: { silent?: boolean } = {}) => {
      if (!layersRef.current?.[mode]) {
        writeLog(`INVALID_MAP_MODE: ${mode}`, "error");
        return;
      }
      setMapMode(mode);
      try {
        localStorage.setItem("titan_v_map_mode", mode);
      } catch {
        /* ignore */
      }
      if (!opts.silent) writeLog(`VIEW_MODE: ${mode.toUpperCase()}`, "cmd");
    },
    [writeLog],
  );

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      const res = await apiFetch(
        `${apiBase.current}/api/v1/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { current_weather?: { temperature: number; windspeed: number } };
      return data.current_weather ?? null;
    } catch {
      return null;
    }
  }, [apiFetch]);

  const syncFromApi = useCallback(
    async (opts: { quiet?: boolean } = {}) => {
      const accessTokenAtStart = sessionAccessTokenRef.current;
      try {
        const [pRes, tRes] = await Promise.all([
          apiFetch(`${apiBase.current}/api/v1/protocols`),
          apiFetch(`${apiBase.current}/api/v1/targets`),
        ]);
        if (sessionAccessTokenRef.current !== accessTokenAtStart) return;

        if (pRes.ok) {
          const pJson = (await pRes.json()) as { protocols?: Protocol[] };
          if (Array.isArray(pJson.protocols) && pJson.protocols.length) setProtocols(pJson.protocols);
        }
        if (sessionAccessTokenRef.current !== accessTokenAtStart) return;

        if (tRes.ok) {
          const tJson = (await tRes.json()) as { targets?: Target[] };
          const rows = Array.isArray(tJson.targets) ? tJson.targets : [];
          if (sessionAccessTokenRef.current !== accessTokenAtStart) return;
          setTargets(
            rows.map((row) => ({
              id: row.id,
              name: row.name,
              lat: Number(row.lat),
              lon: Number(row.lon),
            })),
          );
        } else if (tRes.status === 401) {
          if (sessionAccessTokenRef.current !== accessTokenAtStart) return;
          setTargets([]);
          if (supabaseEnabled && !sessionRef.current) {
            writeLog("REGISTRY_LOCKED — sign in (sidebar), then \\SYNC.", "error");
          } else {
            writeLog("REGISTRY: 401 UNAUTHORIZED (API expects a valid Supabase session).", "error");
          }
        } else if (tRes.status === 503) {
          if (sessionAccessTokenRef.current !== accessTokenAtStart) return;
          setTargets([]);
          writeLog("REGISTRY: API missing Supabase env — areas are not per-user until the API is configured.", "error");
        }
        if (!opts.quiet) writeLog(`API_LINK: ${apiBase.current}`, "cmd");
      } catch {
        writeLog("API_UNREACHABLE — START API: cd api && npm run dev", "error");
      }
    },
    [writeLog, apiFetch, supabaseEnabled],
  );

  useEffect(() => {
    if (!authReady) return;
    setTargets([]);
    void syncFromApi();
  }, [authReady, syncFromApi, session?.access_token]);

  const addTarget = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    try {
      const res = await apiFetch(`${apiBase.current}/api/v1/geocode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const payload = (await res.json().catch(() => ({}))) as { message?: string; results?: { lat: number; lon: number; displayName: string }[] };
      if (!res.ok) {
        writeLog(payload.message || "GEOCODE_FAILED", "error");
        return;
      }
      const hit = payload.results?.[0];
      if (!hit) {
        writeLog("NO_RESULTS", "error");
        return;
      }
      const name = hit.displayName.split(",")[0].toUpperCase();
      if (findDuplicateTarget(targetsRef.current, name, hit.lat, hit.lon)) {
        writeLog("DUPLICATE — ALREADY_IN_REGISTRY (SAME LABEL OR COORDS)", "error");
        return;
      }
      const createRes = await apiFetch(`${apiBase.current}/api/v1/targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, lat: hit.lat, lon: hit.lon }),
      });
      const created = (await createRes.json().catch(() => ({}))) as { message?: string; target?: Target; error?: string };
      if (createRes.status === 409) {
        writeLog(created.message || "DUPLICATE — ALREADY_IN_REGISTRY", "error");
        return;
      }
      if (!createRes.ok || !created.target) {
        writeLog(created.message || "TARGET_CREATE_FAILED", "error");
        return;
      }
      const node: Target = {
        id: created.target.id,
        name: created.target.name,
        lat: created.target.lat,
        lon: created.target.lon,
      };
      setTargets((prev) => [...prev, node]);
      writeLog(`LOCKED: ${node.name}`, "cmd");
      setSearchQuery("");
    } catch {
      writeLog("NET_ERROR", "error");
    }
  }, [searchQuery, writeLog, apiFetch]);

  const removeNode = useCallback(
    async (id: string) => {
      const index = targetsRef.current.findIndex((t) => String(t.id) === String(id));
      if (index < 0) return;
      try {
        const res = await apiFetch(`${apiBase.current}/api/v1/targets/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok && res.status !== 404) throw new Error("delete");
      } catch {
        writeLog("API_DELETE_FAILED", "error");
        return;
      }
      setTargets((prev) => prev.filter((t) => String(t.id) !== String(id)));
      writeLog("NODE_REMOVED", "error");
      setIntelVisible(false);
    },
    [writeLog, apiFetch],
  );

  const runProtocol = useCallback(
    async (raw: string) => {
      const inputVal = raw.toUpperCase().replace(/[\[\]]/g, "").trim();
      const parts = inputVal.split(/\s+/).filter(Boolean);
      const cmd = parts[0];
      const arg = parts[1];
      const rest = parts.slice(1).join(" ").trim();
      const map = mapRef.current;

      setCmdHistory((h) => [raw, ...h]);
      setHistoryIndex(-1);
      historyDraftRef.current = "";
      setSuppressCmdPalette(false);
      setSuggestionIndex(0);

      if (cmd === "\\MODE" || cmd === "MODE") {
        const token = parts
          .slice(1)
          .join(" ")
          .toUpperCase()
          .replace(/\s+/g, "")
          .replace(/[^A-Z0-9]/g, "");
        const mode = resolveMapModeKey(token);
        if (!mode) {
          writeLog("MODE_USAGE: \\MODE DARK | LIGHT | SAT | TOPO | VECTOR", "error");
          writeLog("ALIASES: GRID, DAY, SAT_STREAM, TERRAIN, VOYAGER", "default");
        } else setMode(mode);
      } else if (cmd === "\\SCAN" || cmd === "SCAN") {
        writeLog("INIT_SCAN...", "cmd");
        try {
          const r = await apiFetch(`${apiBase.current}/api/v1/targets`);
          if (!r.ok) throw new Error("http");
          const j = (await r.json()) as { targets?: Target[] };
          const list = Array.isArray(j.targets) ? j.targets : [];
          list.forEach((t) => writeLog(`NODE_${t.name}: UPLINK_OK`, "default"));
          writeLog(`BUFFER_COUNT: ${list.length}`, "cmd");
        } catch {
          writeLog("SCAN_API_FAILED — FALLBACK_LOCAL", "error");
          targetsRef.current.forEach((t) => writeLog(`NODE_${t.name}: LOCAL_BUFFER`, "default"));
        }
      } else if (cmd === "\\LOCATE" || cmd === "LOCATE") {
        const target = targetsRef.current[parseInt(arg, 10) - 1] ?? targetsRef.current[targetsRef.current.length - 1];
        if (target && map) {
          map.flyTo([target.lat, target.lon], 11);
          setIntelVisible(true);
          setIntelName(target.name);
          setIntelCoords(`${Number(target.lat).toFixed(4)}, ${Number(target.lon).toFixed(4)}`);
          const w = await fetchWeather(target.lat, target.lon);
          if (w) {
            setIntelTemp(`${w.temperature}°C`);
            setIntelWind(`${w.windspeed}KM/H`);
          }
          writeLog(`JUMP_SUCCESS: ${target.name}`, "cmd");
        } else writeLog("INVALID_NODE_ID", "error");
      } else if (cmd === "\\WEATHER" || cmd === "WEATHER") {
        const idx = parseInt(arg, 10) - 1;
        const target = targetsRef.current[idx];
        if (!target) writeLog("INVALID_NODE_ID", "error");
        else {
          const w = await fetchWeather(target.lat, target.lon);
          if (w) writeLog(`WX_${target.name}: ${w.temperature}°C / WIND ${w.windspeed} KM/H`, "cmd");
          else writeLog("WEATHER_API_FAILED", "error");
        }
      } else if (cmd === "\\ADD" || cmd === "ADD") {
        if (!rest) writeLog("ADD_USAGE: \\ADD <LOCATION_QUERY>", "error");
        else {
          try {
            const res = await apiFetch(`${apiBase.current}/api/v1/geocode`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ q: rest }),
            });
            const payload = (await res.json().catch(() => ({}))) as {
              message?: string;
              results?: { lat: number; lon: number; displayName: string }[];
            };
            if (!res.ok) writeLog(payload.message || "GEOCODE_FAILED", "error");
            else {
              const hit = payload.results?.[0];
              if (!hit) writeLog("NO_RESULTS", "error");
              else {
                const name = hit.displayName.split(",")[0].toUpperCase();
                if (findDuplicateTarget(targetsRef.current, name, hit.lat, hit.lon)) {
                  writeLog("DUPLICATE — ALREADY_IN_REGISTRY (SAME LABEL OR COORDS)", "error");
                } else {
                  const createRes = await apiFetch(`${apiBase.current}/api/v1/targets`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, lat: hit.lat, lon: hit.lon }),
                  });
                  const created = (await createRes.json().catch(() => ({}))) as {
                    message?: string;
                    target?: Target;
                    error?: string;
                  };
                  if (createRes.status === 409) writeLog(created.message || "DUPLICATE — ALREADY_IN_REGISTRY", "error");
                  else if (!createRes.ok || !created.target) writeLog(created.message || "TARGET_CREATE_FAILED", "error");
                  else {
                    const node: Target = {
                      id: created.target.id,
                      name: created.target.name,
                      lat: created.target.lat,
                      lon: created.target.lon,
                    };
                    setTargets((prev) => [...prev, node]);
                    writeLog(`LOCKED_VIA_CMD: ${node.name}`, "cmd");
                  }
                }
              }
            }
          } catch {
            writeLog("NET_ERROR", "error");
          }
        }
      } else if (cmd === "\\GEOCODE" || cmd === "GEOCODE") {
        if (!rest) writeLog("GEOCODE_USAGE: \\GEOCODE <LOCATION_QUERY>", "error");
        else {
          try {
            const res = await apiFetch(`${apiBase.current}/api/v1/geocode`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ q: rest }),
            });
            const payload = (await res.json().catch(() => ({}))) as {
              message?: string;
              results?: { lat: number; lon: number; displayName: string }[];
            };
            if (!res.ok) writeLog(payload.message || "GEOCODE_FAILED", "error");
            else {
              const hits = payload.results ?? [];
              if (!hits.length) writeLog("NO_RESULTS", "error");
              else {
                const h = hits[0];
                writeLog(`TOP_HIT: ${h.lat.toFixed(5)}, ${h.lon.toFixed(5)}`, "cmd");
                writeLog(h.displayName, "default");
              }
            }
          } catch {
            writeLog("NET_ERROR", "error");
          }
        }
      } else if (cmd === "\\SYNC" || cmd === "SYNC") {
        await syncFromApi({ quiet: true });
        writeLog("SYNC_COMPLETE // PROTOCOLS + TARGETS", "cmd");
      } else if (cmd === "\\PING" || cmd === "PING") {
        const t0 = performance.now();
        try {
          const r = await apiFetch(`${apiBase.current}/api/v1/system/ping`);
          const ms = Math.round(performance.now() - t0);
          if (r.ok) {
            const j = (await r.json().catch(() => ({}))) as { serverTime?: string };
            writeLog(`PING_OK ${ms}MS // ${j.serverTime ?? ""}`, "cmd");
          } else writeLog("PING_HTTP_ERR", "error");
        } catch {
          writeLog("PING_FAILED", "error");
        }
      } else if (cmd === "\\HEALTH" || cmd === "HEALTH") {
        try {
          const r = await apiFetch(`${apiBase.current}/health`);
          const j = (await r.json().catch(() => ({}))) as { status?: string; service?: string };
          if (r.ok) writeLog(`HEALTH: ${j.status} // ${j.service}`, "cmd");
          else writeLog("HEALTH_HTTP_ERR", "error");
        } catch {
          writeLog("HEALTH_FAILED", "error");
        }
      } else if (cmd === "\\DOCS" || cmd === "DOCS") {
        window.open(`${apiBase.current}/docs`, "_blank", "noopener,noreferrer");
        writeLog(`OPENED_DOCS: ${apiBase.current}/docs`, "cmd");
      } else if (cmd === "\\API" || cmd === "API") {
        writeLog(`API_BASE: ${apiBase.current}`, "cmd");
        writeLog(`OPENAPI_JSON: ${apiBase.current}/openapi.json`, "default");
        writeLog(`SWAGGER: ${apiBase.current}/docs`, "default");
      } else if (cmd === "\\CLEAR" || cmd === "CLEAR") {
        setLogLines([{ id: crypto.randomUUID(), time: timeLabel(), text: ">> TERMINAL_CLEARED", status: "cmd" }]);
      } else if (cmd === "\\HELP" || cmd === "HELP") {
        writeLog("--- TITAN_PROTOCOLS ---", "cmd");
        protocolsRef.current.forEach((p) => writeLog(`${p.cmd} >> ${p.info}`));
        writeLog("ARGS: USE SPACE AFTER COMMAND (E.G. \\ADD LONDON). \\LOCATE USES LIST INDEX.", "default");
        writeLog("TERMINAL: ↑↓ HISTORY | ↑↓ IN MENU (WHEN OPEN) | TAB COMPLETE | ESC CLOSE MENU", "default");
      } else {
        writeLog(`UNKNOWN_CMD: ${cmd}`, "error");
      }

      setTerminalInput("");
    },
    [writeLog, fetchWeather, setMode, syncFromApi, apiFetch],
  );

  const modeKeys: MapModeKey[] = ["dark", "light", "sat", "topo", "voyager"];
  const modeLabels: Record<MapModeKey, string> = {
    dark: "GRID",
    light: "DAY",
    sat: "SAT",
    topo: "TOPO",
    voyager: "VECTOR",
  };

  const { suggestions, paletteTriggerActive } = useMemo(() => {
    const { active, matchPrefix } = stripCommandLeader(terminalInput);
    if (!active) return { suggestions: [] as Protocol[], paletteTriggerActive: false };
    const source = protocols.length > 0 ? protocols : DEFAULT_PROTOCOLS;
    const list = source.filter((p) => protocolPaletteKey(p.cmd).startsWith(matchPrefix));
    return { suggestions: list, paletteTriggerActive: true };
  }, [terminalInput, protocols]);

  const showCmdPalette = paletteTriggerActive && suggestions.length > 0 && !suppressCmdPalette;

  useEffect(() => {
    setSuggestionIndex((i) => Math.min(i, Math.max(0, suggestions.length - 1)));
  }, [suggestions.length, terminalInput]);

  useEffect(() => {
    if (showCmdPalette && !prevPaletteOpenRef.current) setSuggestionIndex(0);
    prevPaletteOpenRef.current = showCmdPalette;
  }, [showCmdPalette]);

  return (
    <div className="titan-safe box-border flex min-h-[100dvh] w-full max-w-[100vw] flex-col items-stretch lg:items-center lg:justify-center">
      <div className="crosshair-v" style={{ left: cross.x }} />
      <div className="crosshair-h" style={{ top: cross.y }} />

      <main className="flex min-h-0 w-full max-w-[1850px] flex-1 flex-col gap-3 max-lg:pb-4 lg:mx-auto lg:h-[min(96vh,calc(100dvh-2rem))] lg:max-h-[min(96vh,calc(100dvh-2rem))] lg:flex-none lg:overflow-x-hidden lg:overflow-y-visible">
        <header className="glass flex flex-wrap items-center justify-between gap-4 rounded-lg border-cyan-500/20 px-6 py-4 lg:px-8">
          <div className="flex flex-wrap items-center gap-6 lg:gap-12">
            <div>
              <h1 className="text-3xl font-black uppercase italic leading-none tracking-tighter text-white">Titan-V</h1>
              <span className="data-font text-[9px] font-bold tracking-[0.4em] text-cyan-400">MULTI_MODE_MAP</span>
            </div>
            <div className="flex max-w-[520px] flex-wrap justify-end gap-1.5 max-lg:max-w-none max-lg:gap-2">
              {modeKeys.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`mode-btn rounded px-3 py-2 data-font text-[9px] max-lg:min-h-[44px] max-lg:min-w-[44px] max-lg:px-3 max-lg:py-2 lg:py-1 ${mapMode === m ? "active" : ""}`}
                >
                  {modeLabels[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="data-font text-xl font-bold text-white">{clock}</p>
            <span className="data-font text-[9px] font-black text-cyan-500">{ping}</span>
          </div>
        </header>

        <div className="grid min-h-0 flex-grow grid-cols-1 gap-4 max-lg:min-h-0 max-lg:overflow-visible lg:grid-cols-12 lg:overflow-x-hidden lg:overflow-y-visible">
          <div className="glass flex min-h-0 flex-col overflow-visible rounded-lg p-6 max-lg:min-h-0 lg:col-span-3 lg:overflow-hidden">
            <h3 className="mb-3 text-[10px] font-black uppercase tracking-widest text-cyan-500 underline decoration-cyan-500/30 underline-offset-8">
              Coordinate_Registry
            </h3>
            <div className="mb-5 shrink-0 rounded border border-cyan-500/25 bg-black/40 p-4">
              <AuthPanel areaCount={targets.length} protocolCount={protocols.length} />
            </div>
            <div className="mb-6 flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="data-font flex-grow border border-white/10 bg-black/50 p-3 text-xs uppercase text-white outline-none focus:border-cyan-500"
                placeholder="LOC_QUERY"
              />
              <button
                type="button"
                onClick={() => void addTarget()}
                className="border border-cyan-500/40 bg-cyan-500/10 px-4 text-[10px] font-black text-cyan-400 transition-all hover:bg-cyan-500 hover:text-black"
              >
                LOAD
              </button>
            </div>
            <div className="flex-grow space-y-2 overflow-y-auto pr-2">
              {targets.map((node, i) => (
                <div
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void runProtocol(`\\LOCATE ${i + 1}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") void runProtocol(`\\LOCATE ${i + 1}`);
                  }}
                  className="target-item flex cursor-pointer items-center justify-between rounded bg-white/5 p-4 text-[10px] data-font"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-black text-cyan-500">[{i + 1}]</span>
                    <span className="font-bold text-white">{node.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeNode(node.id);
                    }}
                    className="btn-delete px-2 text-xs font-black"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`glass relative flex min-h-[50vh] flex-col overflow-hidden rounded-lg border-none lg:min-h-0 ${
              terminalCollapsed ? "lg:col-span-9" : "lg:col-span-6"
            }`}
          >
            <div ref={mapElRef} className="titan-map min-h-0 flex-1" />

            {terminalCollapsed ? (
              <button
                type="button"
                onClick={() => setTerminalCollapsed(false)}
                className="terminal-reopen-btn data-font absolute bottom-20 right-5 z-[1001] rounded-lg border border-cyan-500/55 bg-[rgba(6,10,16,0.92)] px-4 py-2.5 text-[9px] font-black uppercase text-cyan-300 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md max-lg:bottom-28"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-cyan-400" aria-hidden>
                  <path d="M12 4L4 14h5v6h6v-6h5L12 4z" />
                </svg>
                Console
              </button>
            ) : null}

            <div
              className={`intel-card-inner glass absolute right-6 top-6 z-[1000] w-64 border-l-2 border-cyan-500 p-5 shadow-2xl ${
                intelVisible ? "visible" : ""
              }`}
            >
              <span className="data-font mb-4 block text-[8px] font-bold uppercase tracking-widest text-cyan-400">
                Atmospheric_Telemetry
              </span>
              <h2 className="mb-1 text-xl font-black uppercase tracking-tighter text-white">{intelName}</h2>
              <p className="data-font mb-6 text-[10px] tracking-widest text-white/30">{intelCoords}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border border-white/5 bg-black/40 p-3">
                  <span className="mb-1 block text-[8px] uppercase text-white/20">Heat</span>
                  <span className="data-font text-lg font-bold text-white">{intelTemp}</span>
                </div>
                <div className="rounded border border-white/5 bg-black/40 p-3">
                  <span className="mb-1 block text-[8px] uppercase text-white/20">Wind</span>
                  <span className="data-font text-lg font-bold text-white">{intelWind}</span>
                </div>
              </div>
            </div>

            <div className="absolute bottom-6 left-6 z-[1000]">
              <div className="border border-white/10 bg-black/90 px-4 py-2">
                <span className="data-font text-xs font-bold tracking-widest text-cyan-400">{coordHud}</span>
              </div>
            </div>
          </div>

          {!terminalCollapsed ? (
          <div className="glass flex min-h-0 flex-col overflow-x-hidden overflow-y-visible rounded-lg lg:col-span-3">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-cyan-500/20 bg-gradient-to-r from-black/40 to-transparent px-4 py-2.5">
              <span className="data-font text-[9px] font-black uppercase tracking-[0.28em] text-cyan-400/95">
                Console
              </span>
              <button
                type="button"
                onClick={() => setTerminalCollapsed(true)}
                className="data-font rounded-md border border-cyan-500/25 bg-cyan-500/5 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-cyan-200/90 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/15 hover:text-white"
              >
                Hide
              </button>
            </div>
            <div
              ref={logScrollRef}
              className="data-font min-h-0 flex-grow space-y-4 overflow-y-auto overflow-x-hidden p-6 text-[11px] text-white/50"
            >
              {logLines.map((line) => (
                <div
                  key={line.id}
                  className={
                    line.status === "cmd"
                      ? "border-l border-cyan-500 pl-2 font-bold text-cyan-400"
                      : line.status === "error"
                        ? "font-black text-red-500"
                        : ""
                  }
                >
                  <span className="mr-2 opacity-20">[{line.time}]</span>
                  {line.text}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
            <div className="relative z-[80] overflow-visible border-t border-white/10 bg-black/60 p-6">
              <div
                className={`cmd-directory rounded shadow-2xl ${showCmdPalette ? "active" : ""}`}
                style={{ display: showCmdPalette ? "block" : "none" }}
                aria-hidden={!showCmdPalette}
              >
                <div>
                  {suggestions.map((m, ix) => (
                    <button
                      key={m.cmd}
                      type="button"
                      className={`cmd-suggest-row flex w-full justify-between border-b border-white/5 p-3 text-left text-[10px] data-font hover:bg-cyan-500/20 ${
                        ix === suggestionIndex ? "cmd-suggest-selected" : ""
                      }`}
                      onMouseEnter={() => setSuggestionIndex(ix)}
                      onClick={() => void runProtocol(m.cmd)}
                    >
                      <span className="font-black text-cyan-400">{m.cmd}</span>
                      <span className="uppercase text-white/20">{m.info}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xl font-black text-cyan-500">»</span>
                <input
                  type="text"
                  autoComplete="off"
                  autoFocus={!terminalCollapsed}
                  value={terminalInput}
                  onChange={(e) => {
                    setTerminalInput(e.target.value);
                    setHistoryIndex(-1);
                    setSuppressCmdPalette(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      if (showCmdPalette) {
                        e.preventDefault();
                        setSuppressCmdPalette(true);
                      }
                      return;
                    }

                    if (e.key === "Tab" && showCmdPalette && suggestions.length) {
                      e.preventDefault();
                      const pick = suggestions[Math.min(suggestionIndex, suggestions.length - 1)];
                      const full = protocolPaletteKey(pick.cmd);
                      const stem = full.match(/^\\[^\s[\]]+/)?.[0] ?? pick.cmd.split(/\s/)[0] ?? pick.cmd;
                      setTerminalInput(`${stem} `);
                      setSuppressCmdPalette(false);
                      return;
                    }

                    if (showCmdPalette && suggestions.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                      e.preventDefault();
                      const len = suggestions.length;
                      if (e.key === "ArrowDown") {
                        setSuggestionIndex((i) => (i + 1) % len);
                      } else {
                        setSuggestionIndex((i) => (i - 1 + len) % len);
                      }
                      return;
                    }

                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (showCmdPalette && suggestions.length) {
                        const pick = suggestions[Math.min(suggestionIndex, suggestions.length - 1)];
                        void runProtocol(pick.cmd);
                      } else {
                        void runProtocol(terminalInput);
                      }
                      return;
                    }

                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      if (historyIndex === -1) historyDraftRef.current = terminalInput;
                      if (historyIndex < cmdHistory.length - 1) {
                        const next = historyIndex + 1;
                        setHistoryIndex(next);
                        setTerminalInput(cmdHistory[next] ?? "");
                      }
                      return;
                    }

                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      if (historyIndex > 0) {
                        const next = historyIndex - 1;
                        setHistoryIndex(next);
                        setTerminalInput(cmdHistory[next] ?? "");
                      } else if (historyIndex === 0) {
                        setHistoryIndex(-1);
                        setTerminalInput(historyDraftRef.current);
                      }
                    }
                  }}
                  className="data-font w-full border-none bg-transparent text-sm uppercase text-white outline-none placeholder:text-cyan-900"
                  placeholder="\\ OR / THEN COMMAND"
                />
              </div>
            </div>
          </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
