import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { AuthUser } from "../types";
import { getAuthUser, getAuthIdToken, setAuthUser, clearAuth } from "../lib/authStorage";
import { decodeGoogleCredential } from "../lib/decodeGoogleCredential";

interface AuthContextValue {
  user: AuthUser | null;
  idToken: string | null;
  loading: boolean;
  signIn: (credential: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getAuthUser());
  const [idToken, setIdToken] = useState<string | null>(() => getAuthIdToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getAuthUser());
    setIdToken(getAuthIdToken());
    setLoading(false);
  }, []);

  const signIn = useCallback((credential: string) => {
    const decoded = decodeGoogleCredential(credential);
    if (decoded) {
      setAuthUser(decoded, credential);
      setUser(decoded);
      setIdToken(credential);
    }
  }, []);

  const signOut = useCallback(() => {
    clearAuth();
    setUser(null);
    setIdToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, idToken, loading, signIn, signOut }),
    [user, idToken, loading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
