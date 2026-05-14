import { Navigate } from "react-router-dom";
import App from "../App";
import { useAuth } from "../context/AuthContext";

/**
 * When Supabase is configured in the browser, unauthenticated users are sent to `/login` first.
 * Without `VITE_SUPABASE_*`, the map loads immediately (local / demo).
 */
export function HomeGate() {
  const { authReady, supabaseEnabled, session } = useAuth();

  if (!authReady) {
    return (
      <div className="titan-safe flex min-h-[100dvh] items-center justify-center bg-[#020203]">
        <p className="data-font text-sm text-white/40">Loading…</p>
      </div>
    );
  }

  if (supabaseEnabled && !session) {
    return <Navigate to="/login" replace />;
  }

  return <App />;
}
