import type { AuthUser } from "../types";

const AUTH_USER_KEY = "notsent_authUser";
const AUTH_ID_TOKEN_KEY = "notsent_authIdToken";

export function getAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.sub || !parsed?.email) return null;
    return {
      sub: parsed.sub,
      email: parsed.email,
      name: parsed.name ?? parsed.email,
      picture: parsed.picture,
    };
  } catch {
    return null;
  }
}

export function setAuthUser(user: AuthUser | null, idToken: string | null): void {
  if (!user) {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_ID_TOKEN_KEY);
    return;
  }
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  if (idToken) {
    localStorage.setItem(AUTH_ID_TOKEN_KEY, idToken);
  } else {
    localStorage.removeItem(AUTH_ID_TOKEN_KEY);
  }
}

export function getAuthIdToken(): string | null {
  return localStorage.getItem(AUTH_ID_TOKEN_KEY);
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_ID_TOKEN_KEY);
}
