export function getApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (typeof window === "undefined") return "http://localhost:3000";

  const fromQuery = new URLSearchParams(window.location.search).get("api");
  if (fromQuery) {
    const base = fromQuery.replace(/\/$/, "");
    try {
      localStorage.setItem("titan_v_api_base", base);
    } catch {
      /* ignore */
    }
    return base;
  }

  try {
    const saved = localStorage.getItem("titan_v_api_base");
    if (saved) return saved.replace(/\/$/, "");
  } catch {
    /* ignore */
  }

  return "http://localhost:3000";
}
