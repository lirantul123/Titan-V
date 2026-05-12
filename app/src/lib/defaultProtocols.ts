import type { Protocol } from "./types";

export const DEFAULT_PROTOCOLS: Protocol[] = [
  { cmd: "\\MODE [KEY]", info: "MAP: DARK|LIGHT|SAT|TOPO|VECTOR" },
  { cmd: "\\SCAN", info: "PULL_TARGETS_FROM_API + LOG" },
  { cmd: "\\LOCATE [ID]", info: "WARP TO TARGET (E.G. \\LOCATE 1)" },
  { cmd: "\\WEATHER [ID]", info: "FETCH_WEATHER_FOR_TARGET_INDEX" },
  { cmd: "\\ADD [QUERY]", info: "GEOCODE + POST_TARGET (E.G. \\ADD PARIS)" },
  { cmd: "\\GEOCODE [QUERY]", info: "POST_GEOCODE_LOG_TOP_HIT" },
  { cmd: "\\SYNC", info: "RELOAD_PROTOCOLS + TARGETS_FROM_API" },
  { cmd: "\\PING", info: "CALL_API_SYSTEM_PING" },
  { cmd: "\\HEALTH", info: "GET_/health_LIVENESS" },
  { cmd: "\\DOCS", info: "OPEN_SWAGGER_UI_TAB" },
  { cmd: "\\API", info: "LOG_API_BASE_AND_OPENAPI_URL" },
  { cmd: "\\CLEAR", info: "PURGE_TERMINAL_LOG" },
  { cmd: "\\HELP", info: "INDEX_COMMANDS" },
];
