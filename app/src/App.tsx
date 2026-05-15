import type { CircleMarker, Map as LeafletMap } from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthPanel } from "./components/AuthPanel";
import { MapToolbar } from "./components/MapToolbar";
import { TargetIntelCard } from "./components/TargetIntelCard";
import { useAuth } from "./context/AuthContext";
import { getApiBase } from "./lib/apiBase";
import { DEFAULT_PROTOCOLS } from "./lib/defaultProtocols";
import { createBaseLayers, normalizeStoredMapMode, resolveMapModeKey, type MapModeKey } from "./lib/mapModes";
import { createTargetAt, geocodeQuery, reverseGeocode } from "./lib/targetCreate";
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
  const hadSessionRef = useRef(false);

  const apiBase = useRef(getApiBase());
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletLibRef = useRef<typeof import("leaflet") | null>(null);
  const layersRef = useRef<ReturnType<typeof createBaseLayers> | null>(null);
  const markersRef = useRef<CircleMarker[]>([]);
  const focusTargetRef = useRef<(id: string) => void>(() => {});

  const [mapReady, setMapReady] = useState(false);
  const [targets, setTargets] = useState<Target[]>([]);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const [protocols, setProtocols] = useState<Protocol[]>(DEFAULT_PROTOCOLS);
  const protocolsRef = useRef(protocols);
  protocolsRef.current = protocols;

  const [mapMode, setMapMode] = useState<MapModeKey>(() => {
    try {
      return normalizeStoredMapMode(localStorage.getItem("titan_v_map_mode"));
    } catch {
      /* ignore */
    }
    return "map";
  });

  const [logLines, setLogLines] = useState<LogLine[]>([
    { id: "boot", time: timeLabel(), text: ">> SYSTEM_READY", status: "cmd" },
  ]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const prevPaletteOpenRef = useRef(false);

  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [intelTemp, setIntelTemp] = useState("--°C");
  const [intelWind, setIntelWind] = useState("--KM/H");
  const [pinMode, setPinMode] = useState(() => {
    try {
      const s = localStorage.getItem("titan_v_map_tool");
      if (s === "pin") return true;
    } catch {
      /* ignore */
    }
    return false;
  });
  const [registryFilter, setRegistryFilter] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

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

  const selectedTarget = useMemo(
    () => targets.find((t) => String(t.id) === String(selectedTargetId)) ?? null,
    [targets, selectedTargetId],
  );

  const selectedIndex = useMemo(() => {
    if (!selectedTarget) return -1;
    return targets.findIndex((t) => String(t.id) === String(selectedTarget.id));
  }, [targets, selectedTarget]);

  const filteredTargets = useMemo(() => {
    const q = registryFilter.trim().toUpperCase();
    if (!q) return targets;
    return targets.filter((t) => t.name.toUpperCase().includes(q));
  }, [targets, registryFilter]);

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
    try {
      localStorage.setItem("titan_v_map_tool", pinMode ? "pin" : "navigate");
    } catch {
      /* ignore */
    }
  }, [pinMode]);

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
      layers.map.addTo(map);
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

  const refreshMapView = useCallback(() => {
    requestAnimationFrame(() => {
      mapRef.current?.invalidateSize({ animate: false });
    });
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    const next = layers[mapMode];
    if (map.hasLayer(next)) return;
    Object.values(layers).forEach((layer) => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    next.addTo(map);
    refreshMapView();
  }, [mapMode, mapReady, refreshMapView]);

  useEffect(() => {
    if (!mapReady) return;
    refreshMapView();
  }, [pinMode, mapReady, refreshMapView]);

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

  const focusTarget = useCallback(
    async (id: string, opts: { fly?: boolean; silent?: boolean } = {}) => {
      const target = targetsRef.current.find((t) => String(t.id) === String(id));
      const map = mapRef.current;
      if (!target) return;
      setSelectedTargetId(String(target.id));
      if (map && opts.fly !== false) {
        map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 10), { duration: 0.8 });
      }
      if (!opts.silent) writeLog(`FOCUS: ${target.name}`, "cmd");
    },
    [writeLog],
  );

  focusTargetRef.current = (id) => {
    void focusTarget(id, { fly: true, silent: true });
  };

  useEffect(() => {
    if (!selectedTarget) {
      setIntelTemp("--°C");
      setIntelWind("--KM/H");
      return;
    }
    const targetId = String(selectedTarget.id);
    let cancelled = false;
    void (async () => {
      const w = await fetchWeather(selectedTarget.lat, selectedTarget.lon);
      if (cancelled || String(selectedTargetId) !== targetId) return;
      if (w) {
        setIntelTemp(`${w.temperature}°C`);
        setIntelWind(`${w.windspeed}KM/H`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTarget, selectedTargetId, fetchWeather]);

  useEffect(() => {
    if (!authReady || !supabaseEnabled) return;
    if (session) {
      hadSessionRef.current = true;
      return;
    }
    if (hadSessionRef.current) {
      hadSessionRef.current = false;
      setTargets([]);
      setSelectedTargetId(null);
    }
  }, [authReady, supabaseEnabled, session]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletLibRef.current;
    if (!map || !L) return;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = targets.map((t, i) => {
      const selected = String(t.id) === String(selectedTargetId);
      const marker = L.circleMarker([t.lat, t.lon], {
        radius: selected ? 12 : 8,
        color: selected ? "#ffffff" : "#00f3ff",
        weight: selected ? 3 : 2,
        fillColor: "#00f3ff",
        fillOpacity: selected ? 0.7 : 0.4,
      });
      marker.bindTooltip(`[${i + 1}] ${t.name}`, {
        direction: "top",
        className: "titan-marker-tip",
        opacity: 0.95,
      });
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        focusTargetRef.current(String(t.id));
      });
      marker.addTo(map);
      return marker;
    });
  }, [targets, mapReady, selectedTargetId]);

  const fitAllTargets = useCallback(() => {
    const map = mapRef.current;
    const L = leafletLibRef.current;
    const list = targetsRef.current;
    if (!map || !L || !list.length) {
      writeLog("NO_AREAS_TO_FIT", "error");
      return;
    }
    const bounds = L.latLngBounds(list.map((t) => [t.lat, t.lon] as [number, number]));
    if (!bounds.isValid()) {
      writeLog("FIT_VIEW_FAILED", "error");
      return;
    }
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const isPoint = ne.lat === sw.lat && ne.lng === sw.lng;
    if (isPoint) {
      map.flyTo(bounds.getCenter(), 11, { duration: 0.8 });
    } else {
      map.flyToBounds(bounds, { padding: [56, 56], maxZoom: 12, duration: 0.8 });
    }
    refreshMapView();
    writeLog(`FIT_VIEW: ${list.length} NODES`, "cmd");
  }, [writeLog, refreshMapView]);

  const handleMapZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
    refreshMapView();
  }, [refreshMapView]);

  const handleMapZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
    refreshMapView();
  }, [refreshMapView]);

  const pinAtCoords = useCallback(
    async (lat: number, lon: number) => {
      if (pinBusy) return;
      setPinBusy(true);
      writeLog(`PINNING ${lat.toFixed(4)}, ${lon.toFixed(4)}...`, "cmd");
      try {
        const hit =
          (await reverseGeocode(apiFetch, apiBase.current, lat, lon)) ??
          ({ lat, lon, displayName: `PIN ${lat.toFixed(3)}, ${lon.toFixed(3)}` } as const);
        const result = await createTargetAt(apiFetch, apiBase.current, targetsRef.current, hit);
        if (!result.ok) {
          writeLog(result.message, result.reason === "duplicate" ? "error" : "error");
          return;
        }
        setTargets((prev) => [...prev, result.target]);
        await focusTarget(String(result.target.id), { fly: true, silent: true });
        writeLog(`PINNED: ${result.target.name}`, "cmd");
      } catch {
        writeLog("PIN_FAILED", "error");
      } finally {
        setPinBusy(false);
      }
    },
    [apiFetch, focusTarget, pinBusy, writeLog],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !pinMode) return;
    const onClick = (e: { latlng: { lat: number; lng: number } }) => {
      void pinAtCoords(e.latlng.lat, e.latlng.lng);
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [mapReady, pinMode, pinAtCoords]);

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
      const result = await createTargetAt(apiFetch, apiBase.current, targetsRef.current, hit);
      if (!result.ok) {
        writeLog(result.message, "error");
        return;
      }
      setTargets((prev) => [...prev, result.target]);
      await focusTarget(String(result.target.id), { fly: true, silent: true });
      writeLog(`LOCKED: ${result.target.name}`, "cmd");
      setSearchQuery("");
    } catch {
      writeLog("NET_ERROR", "error");
    }
  }, [searchQuery, writeLog, apiFetch, focusTarget]);

  const removeNode = useCallback(
    async (id: string, opts: { confirm?: boolean } = {}) => {
      const index = targetsRef.current.findIndex((t) => String(t.id) === String(id));
      if (index < 0) return;
      const node = targetsRef.current[index];
      if (opts.confirm !== false) {
        const label = node.name.length > 48 ? `${node.name.slice(0, 48)}…` : node.name;
        if (!window.confirm(`Remove area [${index + 1}] ${label}?`)) return;
      }
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
      if (String(selectedTargetId) === String(id)) setSelectedTargetId(null);
      writeLog("NODE_REMOVED", "error");
    },
    [writeLog, apiFetch, selectedTargetId],
  );

  const runProtocol = useCallback(
    async (raw: string) => {
      const inputVal = raw.toUpperCase().replace(/[\[\]]/g, "").trim();
      const parts = inputVal.split(/\s+/).filter(Boolean);
      const cmd = parts[0];
      const arg = parts[1];
      const rest = parts.slice(1).join(" ").trim();

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
          writeLog("MODE_USAGE: \\MODE MAP | SATELLITE", "error");
          writeLog("ALIASES: ROAD, SAT, IMAGERY", "default");
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
        if (target) {
          await focusTarget(String(target.id));
          writeLog(`JUMP_SUCCESS: ${target.name}`, "cmd");
        } else writeLog("INVALID_NODE_ID", "error");
      } else if (cmd === "\\FIT" || cmd === "FIT") {
        fitAllTargets();
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
            const results = await geocodeQuery(apiFetch, apiBase.current, rest);
            const hit = results[0];
            if (!hit) writeLog("NO_RESULTS", "error");
            else {
              const result = await createTargetAt(apiFetch, apiBase.current, targetsRef.current, hit);
              if (!result.ok) writeLog(result.message, "error");
              else {
                setTargets((prev) => [...prev, result.target]);
                writeLog(`LOCKED_VIA_CMD: ${result.target.name}`, "cmd");
              }
            }
          } catch (e) {
            writeLog(e instanceof Error ? e.message : "NET_ERROR", "error");
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
        writeLog("MAP: TOOLBAR ⊕ PIN MODE | CLICK MARKERS | FILTER REGISTRY | \\FIT ALL AREAS", "default");
      } else {
        writeLog(`UNKNOWN_CMD: ${cmd}`, "error");
      }

      setTerminalInput("");
    },
    [writeLog, fetchWeather, setMode, syncFromApi, apiFetch, focusTarget, fitAllTargets],
  );

  const modeKeys: MapModeKey[] = ["map", "satellite"];
  const modeLabels: Record<MapModeKey, string> = {
    map: "MAP",
    satellite: "SATELLITE",
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
              <span className="data-font text-[9px] font-bold tracking-[0.4em] text-cyan-400">MAP_SATELLITE</span>
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addTarget();
                }}
                className="data-font flex-grow border border-white/10 bg-black/50 p-3 text-xs uppercase text-white outline-none focus:border-cyan-500"
                placeholder="LOC_QUERY"
              />
              <button
                type="button"
                onClick={() => void addTarget()}
                className="titan-action-btn border border-cyan-500/40 bg-cyan-500/10 px-4 text-[10px] font-black text-cyan-400"
              >
                LOAD
              </button>
            </div>
            <input
              type="text"
              value={registryFilter}
              onChange={(e) => setRegistryFilter(e.target.value)}
              className="data-font mb-4 w-full border border-white/10 bg-black/40 px-3 py-2 text-[10px] uppercase text-white/80 outline-none focus:border-cyan-500/50"
              placeholder="FILTER AREAS"
            />
            <div className="flex-grow space-y-2 overflow-y-auto pr-2">
              {filteredTargets.length === 0 ? (
                <p className="data-font px-2 py-6 text-center text-[10px] text-white/25">
                  {targets.length ? "NO MATCHES" : "NO AREAS — SEARCH OR PIN ON MAP"}
                </p>
              ) : null}
              {filteredTargets.map((node) => {
                const i = targets.findIndex((t) => String(t.id) === String(node.id));
                const selected = String(node.id) === String(selectedTargetId);
                return (
                <div
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void focusTarget(String(node.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") void focusTarget(String(node.id));
                  }}
                  className={`target-item group flex cursor-pointer items-center justify-between rounded p-4 text-[10px] data-font ${
                    selected ? "target-item-selected" : "bg-white/5"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-cyan-500">[{i + 1}]</span>
                      <span className="line-clamp-2 break-words font-bold leading-snug text-white" title={node.name}>
                        {node.name}
                      </span>
                    </div>
                    <p className="data-font mt-1 pl-7 text-[9px] text-white/25">
                      {node.lat.toFixed(3)}, {node.lon.toFixed(3)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeNode(node.id);
                    }}
                    className="registry-mini-btn registry-mini-btn-danger shrink-0 opacity-60 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
                );
              })}
            </div>
          </div>

          <div
            className={`glass relative flex min-h-[50vh] flex-col overflow-hidden rounded-lg border-none lg:min-h-0 ${
              terminalCollapsed ? "lg:col-span-9" : "lg:col-span-6"
            }`}
          >
            <div
              className={`relative min-h-0 flex-1 ${pinMode ? "titan-map--pin-mode" : ""}`}
            >
              <div ref={mapElRef} className="titan-map absolute inset-0 z-0" />

              <MapToolbar
                pinMode={pinMode}
                pinBusy={pinBusy}
                onPinModeChange={setPinMode}
                onZoomIn={handleMapZoomIn}
                onZoomOut={handleMapZoomOut}
                onFitAll={() => fitAllTargets()}
                areaCount={targets.length}
              />

              <TargetIntelCard
              visible={selectedTarget !== null}
              target={selectedTarget}
              index={selectedIndex >= 0 ? selectedIndex : 0}
              temp={intelTemp}
              wind={intelWind}
              onClose={() => setSelectedTargetId(null)}
              onCenter={() => {
                if (selectedTarget) void focusTarget(String(selectedTarget.id), { fly: true, silent: true });
              }}
              onRefreshWeather={() => {
                if (!selectedTarget) return;
                const id = String(selectedTarget.id);
                setIntelTemp("--°C");
                setIntelWind("--KM/H");
                void fetchWeather(selectedTarget.lat, selectedTarget.lon).then((w) => {
                  if (String(selectedTargetId) !== id || !w) return;
                  setIntelTemp(`${w.temperature}°C`);
                  setIntelWind(`${w.windspeed}KM/H`);
                });
              }}
              onRemove={() => {
                if (selectedTarget) void removeNode(selectedTarget.id);
              }}
              onCopyCoords={() => {
                if (!selectedTarget) return;
                const text = `${selectedTarget.lat.toFixed(5)}, ${selectedTarget.lon.toFixed(5)}`;
                void navigator.clipboard.writeText(text).then(
                  () => writeLog(`COPIED: ${text}`, "cmd"),
                  () => writeLog("CLIPBOARD_FAILED", "error"),
                );
              }}
            />

              <div className="absolute bottom-6 left-6 right-6 z-[1000] flex items-center justify-between gap-3">
                <div className="pointer-events-none border border-white/10 bg-black/90 px-4 py-2">
                  <span className="data-font text-xs font-bold tracking-widest text-cyan-400">{coordHud}</span>
                </div>
                {terminalCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setTerminalCollapsed(false)}
                    className="terminal-reopen-btn data-font shrink-0 rounded-lg border border-cyan-500/55 bg-[rgba(6,10,16,0.92)] px-4 py-2 text-[9px] font-black uppercase text-cyan-300 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-cyan-400" aria-hidden>
                      <path d="M12 4L4 14h5v6h6v-6h5L12 4z" />
                    </svg>
                    Console
                  </button>
                ) : null}
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
