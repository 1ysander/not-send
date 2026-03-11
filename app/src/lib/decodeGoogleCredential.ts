import type { AuthUser } from "../types";

/** Decode Google OAuth JWT credential payload (middle segment). */
export function decodeGoogleCredential(credential: string): AuthUser | null {
  try {
    const parts = credential.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const decoded = JSON.parse(json) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!decoded.sub || !decoded.email) return null;
    return {
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name ?? decoded.email,
      picture: decoded.picture,
    };
  } catch {
    return null;
  }
}
