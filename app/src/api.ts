const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
const DEFAULT_TIMEOUT_MS = 15_000;
const STREAM_TIMEOUT_MS = 60_000;

export interface UserContext {
  breakupSummary?: string;
  partnerName?: string;
  conversationContext?: "sms" | "instagram" | "whatsapp" | "generic";
}

export interface PartnerContext {
  partnerName: string;
  sampleMessages?: Array<{ fromPartner: boolean; text: string }>;
}

export interface Stats {
  interceptionsCount: number;
  messagesNeverSentCount: number;
}

function parseError(body: unknown): string {
  if (body && typeof body === "object" && "error" in body && typeof (body as { error?: string }).error === "string") {
    return (body as { error: string }).error;
  }
  return "";
}

export async function createSession(
  messageAttempted: string,
  options?: { userContext?: UserContext; deviceId?: string }
): Promise<{ sessionId: string }> {
  const body: Record<string, unknown> = { messageAttempted };
  if (options?.userContext) body.userContext = options.userContext;
  if (options?.deviceId) body.deviceId = options.deviceId;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const res = await fetch(`${API_BASE}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(id);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseError(err) || `Session failed: ${res.status}`);
  }
  return res.json();
}

export async function updateSessionOutcome(
  sessionId: string,
  outcome: "intercepted" | "sent"
): Promise<void> {
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseError(err) || `Update failed: ${res.status}`);
  }
}

export async function getStats(): Promise<Stats | null> {
  try {
    const res = await fetch(`${API_BASE}/stats`, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function streamChat(
  sessionId: string,
  messageAttempted: string,
  messages: { role: string; content: string }[],
  onChunk: (text: string) => void,
  options?: { userContext?: UserContext; deviceId?: string }
): Promise<void> {
  const body: Record<string, unknown> = { sessionId, messageAttempted, messages };
  if (options?.userContext) body.userContext = options.userContext;
  if (options?.deviceId) body.deviceId = options.deviceId;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseError(err) || `Chat failed: ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data) as { text?: string };
            if (typeof parsed.text === "string") onChunk(parsed.text);
          } catch {
            // skip malformed chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function streamClosureChat(
  messages: { role: string; content: string }[],
  partnerContext: PartnerContext,
  onChunk: (text: string) => void,
  options?: { userContext?: UserContext; deviceId?: string }
): Promise<void> {
  const body: Record<string, unknown> = { messages, partnerContext };
  if (options?.userContext) body.userContext = options.userContext;
  if (options?.deviceId) body.deviceId = options.deviceId;
  const res = await fetch(`${API_BASE}/chat/closure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseError(err) || `Closure chat failed: ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data) as { text?: string };
          if (parsed.text) onChunk(parsed.text);
        } catch {
          // skip
        }
      }
    }
  }
}

export async function saveUserContextToBackend(
  deviceId: string,
  userContext: UserContext
): Promise<void> {
  const res = await fetch(`${API_BASE}/context/user`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, userContext }),
  });
  if (!res.ok) throw new Error("Failed to save context");
}

export type BackendHealth = { ok: true; api?: string } | { ok: false; error: string };

export async function checkBackendHealth(): Promise<BackendHealth> {
  try {
    const healthUrl = `${API_BASE.replace(/\/$/, "")}/health`;
    const res = await fetch(healthUrl, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { status?: string; api?: string };
    return { ok: true, api: data.api };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

export async function streamSupportChat(
  messages: { role: string; content: string }[],
  onChunk: (text: string) => void,
  options?: { userContext?: UserContext; deviceId?: string }
): Promise<void> {
  const body: Record<string, unknown> = { messages };
  if (options?.userContext) body.userContext = options.userContext;
  if (options?.deviceId) body.deviceId = options.deviceId;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
  const res = await fetch(`${API_BASE}/chat/support`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseError(err) || `Support chat failed: ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data) as { text?: string };
            if (typeof parsed.text === "string") onChunk(parsed.text);
          } catch {
            // skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function getPartnerContextFromBackend(deviceId: string): Promise<PartnerContext | null> {
  try {
    const res = await fetch(`${API_BASE}/context/partner?deviceId=${encodeURIComponent(deviceId)}`, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { partnerName?: string; sampleMessages?: Array<{ fromPartner: boolean; text: string }> };
    if (!data?.partnerName) return null;
    return { partnerName: data.partnerName, sampleMessages: data.sampleMessages };
  } catch {
    return null;
  }
}

export async function savePartnerContextToBackend(
  deviceId: string,
  partnerContext: PartnerContext
): Promise<void> {
  const res = await fetch(`${API_BASE}/context/partner`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, partnerContext }),
  });
  if (!res.ok) throw new Error("Failed to save partner context");
}
