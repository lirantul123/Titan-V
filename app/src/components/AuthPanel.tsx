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
          className="mode-btn w-full rounded py-2.5 data-font text-[10px] font-black uppercase tracking-widest text-cyan-400"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Link
        to="/login"
        className="mode-btn inline-flex w-full items-center justify-center rounded py-2.5 data-font text-[10px] font-black uppercase tracking-widest text-cyan-400"
      >
        Sign in
      </Link>
    </div>
  );
}
