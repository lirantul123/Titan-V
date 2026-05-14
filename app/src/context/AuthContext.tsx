import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "../lib/supabaseBrowser";

type AuthContextValue = {
  supabaseEnabled: boolean;
  authReady: boolean;
  session: Session | null;
  user: User | null;
  /** Same as `fetch` but adds `Authorization: Bearer` when a Supabase session exists */
  apiFetch: (input: string | URL, init?: RequestInit) => Promise<Response>;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error?: string; sessionEstablished: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const supabaseEnabled = isBrowserSupabaseConfigured();

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    void (async () => {
      try {
        await supabase.auth.initialize();
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
      } finally {
        setAuthReady(true);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event !== "SIGNED_IN") return;
      const hasPkceCode = window.location.search.includes("code=");
      const hasImplicitHash = /access_token|refresh_token|error_description|error_code/i.test(window.location.hash);
      if (hasPkceCode || hasImplicitHash) {
        queueMicrotask(() => {
          let p = window.location.pathname || "/";
          if (p !== "/" && p.endsWith("/")) p = p.slice(0, -1);
          const tail = p === "/" ? "/#/" : `${p}/#/`;
          window.history.replaceState({}, document.title, tail);
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const apiFetch = useCallback((input: string | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers ?? undefined);
    const token = sessionRef.current?.access_token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }, []);

  /** Base URL for email confirmation links on sign-up (no hash). */
  const emailRedirectBase = useCallback(() => {
    const u = new URL(window.location.href);
    u.hash = "";
    u.search = "";
    const p = u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
    return `${u.origin}${p}`;
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return { error: "Supabase is not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)" };
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return { error: error?.message };
    },
    [supabase],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return { error: "Supabase is not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)", sessionEstablished: false };
      const trimmed = email.trim();
      const { data, error } = await supabase.auth.signUp({
        email: trimmed,
        password,
        options: { emailRedirectTo: emailRedirectBase() },
      });
      if (error) return { error: error.message, sessionEstablished: false };
      if (data.session) return { sessionEstablished: true };

      const { error: signInError } = await supabase.auth.signInWithPassword({ email: trimmed, password });
      if (!signInError) return { sessionEstablished: true };

      return {
        error: "Sign-in blocked for new accounts.",
        sessionEstablished: false,
      };
    },
    [supabase, emailRedirectBase],
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      supabaseEnabled,
      authReady,
      session,
      user: session?.user ?? null,
      apiFetch,
      signInWithPassword,
      signUpWithPassword,
      signOut,
    }),
    [supabaseEnabled, authReady, session, apiFetch, signInWithPassword, signUpWithPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
