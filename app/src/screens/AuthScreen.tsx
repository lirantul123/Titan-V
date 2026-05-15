import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Tab = "signin" | "register";

const inputClass =
  "data-font w-full min-h-[48px] border border-white/15 bg-black/60 px-4 py-3 text-base text-white outline-none placeholder:text-white/25 focus:border-cyan-500/60 sm:text-sm";

export function AuthScreen() {
  const navigate = useNavigate();
  const { supabaseEnabled, authReady, session, signInWithPassword, signUpWithPassword } = useAuth();

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setPassword("");
    setConfirm("");
    setErr(null);
    setInfo(null);
  }, [tab]);

  const resetFeedback = useCallback(() => {
    setErr(null);
    setInfo(null);
  }, []);

  const onSignIn = useCallback(async () => {
    resetFeedback();
    if (!email.trim() || !password) {
      setErr("Email and password are required");
      return;
    }
    setBusy(true);
    const { error } = await signInWithPassword(email, password);
    setBusy(false);
    if (error) setErr(error);
    else navigate("/", { replace: true });
  }, [email, password, navigate, resetFeedback, signInWithPassword]);

  const onRegister = useCallback(async () => {
    resetFeedback();
    if (!email.trim() || !password) {
      setErr("Email and password are required");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match");
      return;
    }
    setBusy(true);
    const { error, sessionEstablished } = await signUpWithPassword(email, password);
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    if (sessionEstablished) {
      navigate("/", { replace: true });
      return;
    }
    setInfo("Check your email to confirm the account, then sign in.");
    setTab("signin");
  }, [confirm, email, navigate, password, resetFeedback, signUpWithPassword]);

  if (authReady && session) {
    return <Navigate to="/" replace />;
  }

  if (!authReady) {
    return (
      <div className="titan-safe flex min-h-[100dvh] items-center justify-center bg-[#020203]">
        <p className="data-font text-sm text-white/35">…</p>
      </div>
    );
  }

  if (!supabaseEnabled) {
    return (
      <div className="titan-safe flex min-h-[100dvh] items-center justify-center bg-[#020203]">
        <div className="glass w-full max-w-sm rounded-xl p-8 text-center">
          <h1 className="mb-4 text-2xl font-black uppercase italic tracking-tighter text-white">Titan-V</h1>
          <p className="data-font mb-6 text-sm text-white/45">Sign-in is not enabled for this build.</p>
          <Link to="/" className="data-font text-sm font-black uppercase tracking-widest text-cyan-400 underline">
            Back to map
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="titan-safe flex min-h-[100dvh] items-center justify-center bg-[#020203]">
      <div className="glass w-full max-w-md rounded-xl border-cyan-500/30 p-6 shadow-[0_0_40px_rgba(6,182,212,0.12)] max-[480px]:mx-0 max-[480px]:rounded-lg sm:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black uppercase italic leading-none tracking-tighter text-white sm:text-3xl">Titan-V</h1>
          <p className="data-font mt-2 text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-400">Login · Register</p>
        </div>

        <div className="mb-8 flex rounded border border-white/10 p-1">
          <button
            type="button"
            onClick={() => {
              setTab("signin");
              resetFeedback();
            }}
            className={`data-font min-h-[44px] flex-1 rounded py-3 text-[10px] font-black uppercase tracking-widest sm:min-h-0 sm:py-2.5 ${
              tab === "signin" ? "bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.5)]" : "text-white/45 hover:text-white/70"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("register");
              resetFeedback();
            }}
            className={`data-font min-h-[44px] flex-1 rounded py-3 text-[10px] font-black uppercase tracking-widest sm:min-h-0 sm:py-2.5 ${
              tab === "register" ? "bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.5)]" : "text-white/45 hover:text-white/70"
            }`}
          >
            Register
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="data-font mb-1.5 block text-[9px] font-black uppercase tracking-widest text-white/35">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@domain.com"
            />
          </div>

          {tab === "signin" ? (
            <>
              <div>
                <label htmlFor="auth-password" className="data-font mb-1.5 block text-[9px] font-black uppercase tracking-widest text-white/35">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSignIn()}
                className="data-font w-full min-h-[48px] rounded border border-cyan-500/50 bg-cyan-500/15 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300 transition-colors hover:bg-cyan-500/25 disabled:opacity-40 sm:min-h-0"
              >
                {busy ? "Please wait…" : "Sign in"}
              </button>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="auth-pass-new" className="data-font mb-1.5 block text-[9px] font-black uppercase tracking-widest text-white/35">
                  Password
                </label>
                <input
                  id="auth-pass-new"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label htmlFor="auth-pass-2" className="data-font mb-1.5 block text-[9px] font-black uppercase tracking-widest text-white/35">
                  Confirm password
                </label>
                <input
                  id="auth-pass-2"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                  placeholder="Repeat password"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRegister()}
                className="data-font w-full min-h-[48px] rounded border border-cyan-500/50 bg-cyan-500/15 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300 transition-colors hover:bg-cyan-500/25 disabled:opacity-40 sm:min-h-0"
              >
                {busy ? "Please wait…" : "Create account"}
              </button>
            </>
          )}
        </div>

        {err ? <p className="data-font mt-5 text-center text-sm text-red-400">{err}</p> : null}
        {info ? <p className="data-font mt-5 text-center text-sm text-cyan-300/90">{info}</p> : null}
      </div>
    </div>
  );
}
