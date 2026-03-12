import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import type { AuthUser } from "../types";
import { supabase, supabaseEnabled } from "../lib/supabase";
import { getAuthUser, getAuthIdToken, setAuthUser, clearAuth } from "../lib/authStorage";
import { decodeGoogleCredential } from "../lib/decodeGoogleCredential";

interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  /** Access token — supabase session token or legacy Google JWT */
  idToken: string | null;
  loading: boolean;
  signIn: (credential?: string) => void | Promise<void>;
  signOut: () => void | Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function supabaseSessionToAuthUser(session: Session): AuthUser {
  const u = session.user;
  return {
    sub: u.id,
    email: u.email ?? "",
    name:
      u.user_metadata?.full_name ??
      u.user_metadata?.name ??
      u.email ??
      "",
    picture: u.user_metadata?.avatar_url ?? u.user_metadata?.picture,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() =>
    supabaseEnabled ? null : getAuthUser()
  );
  const [session, setSession] = useState<Session | null>(null);
  const [idToken, setIdToken] = useState<string | null>(() =>
    supabaseEnabled ? null : getAuthIdToken()
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseEnabled) {
      // Legacy: load from localStorage
      setUser(getAuthUser());
      setIdToken(getAuthIdToken());
      setLoading(false);
      return;
    }

    // Supabase: get current session and subscribe to changes
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      setSession(s);
      setUser(s ? supabaseSessionToAuthUser(s) : null);
      setIdToken(s?.access_token ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setUser(s ? supabaseSessionToAuthUser(s) : null);
      setIdToken(s?.access_token ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (credential?: string) => {
    if (supabaseEnabled) {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      return;
    }
    // Legacy: decode Google JWT from @react-oauth/google
    if (credential) {
      const decoded = decodeGoogleCredential(credential);
      if (decoded) {
        setAuthUser(decoded, credential);
        setUser(decoded);
        setIdToken(credential);
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    if (supabaseEnabled) {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setIdToken(null);
      return;
    }
    clearAuth();
    setUser(null);
    setIdToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, session, idToken, loading, signIn, signOut }),
    [user, session, idToken, loading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
