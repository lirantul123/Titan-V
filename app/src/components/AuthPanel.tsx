import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export type AuthPanelProps = {
  /** Rows in the coordinate registry (from API). */
  areaCount: number;
  /** Terminal commands available after API sync. */
  protocolCount: number;
};

export function AuthPanel({ areaCount, protocolCount }: AuthPanelProps) {
  const { supabaseEnabled, authReady, session, user, signOut } = useAuth();

  if (!supabaseEnabled) {
    return (
      <div className="data-font text-[9px] text-white/40">
        <span className="font-black uppercase tracking-widest text-white/50">Registry</span> · local
      </div>
    );
  }

  if (!authReady) {
    return <span className="data-font text-[9px] text-white/35">…</span>;
  }

  if (session?.user) {
    const label =
      user?.email ??
      (typeof user?.user_metadata?.email === "string" ? user.user_metadata.email : null) ??
      (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ??
      "—";
    return (
      <div className="flex flex-col gap-3 text-left">
        <div>
          <p className="data-font mb-1 text-[8px] font-black uppercase tracking-widest text-cyan-500">Account</p>
          <p className="data-font truncate text-[11px] font-bold text-white" title={label}>
            {label}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
          <div>
            <p className="data-font text-[8px] uppercase tracking-widest text-white/35">Areas</p>
            <p className="data-font text-lg font-black tabular-nums text-cyan-400">{areaCount}</p>
          </div>
          <div>
            <p className="data-font text-[8px] uppercase tracking-widest text-white/35">Commands</p>
            <p className="data-font text-lg font-black tabular-nums text-white/80">{protocolCount}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="group relative w-full overflow-hidden rounded-md border border-white/10 bg-white/[0.04] py-2.5 text-center data-font text-[10px] font-black uppercase tracking-[0.2em] text-white/80 shadow-sm transition-all duration-200 hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-200 hover:shadow-[0_0_20px_rgba(255,49,49,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500/60 active:scale-[0.98]"
        >
          <span className="relative z-10">Sign out</span>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,49,49,0.08), transparent)",
            }}
          />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Link
        to="/login"
        className="group inline-flex w-full items-center justify-center rounded-md border border-cyan-500/25 bg-cyan-500/[0.06] py-2.5 text-center data-font text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300 shadow-sm transition-all duration-200 hover:border-cyan-400/55 hover:bg-cyan-500/15 hover:text-white hover:shadow-[0_0_22px_rgba(0,243,255,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500/70 active:scale-[0.98]"
      >
        Sign in
      </Link>
    </div>
  );
}
