import { io as ioClient, type Socket } from "socket.io-client";

/** Base URL for Socket.IO (same host as API, no path). */
function getSocketUrl(): string {
  const api = import.meta.env.VITE_API_URL;
  if (typeof api === "string" && (api.startsWith("http://") || api.startsWith("https://"))) {
    try {
      const u = new URL(api);
      return u.origin;
    } catch {
      // fallback
    }
  }
  return window.location.origin;
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = ioClient(getSocketUrl(), {
      path: "/socket.io",
      withCredentials: true,
      autoConnect: true,
    });
  }
  return socket;
}

export type ConversationUpdatePayload = {
  sessionId: string;
  messages: Array<{ role: string; content: string; timestamp?: number }>;
};

export function onConversationUpdate(callback: (payload: ConversationUpdatePayload) => void): () => void {
  const s = getSocket();
  s.on("conversation_update", callback);
  return () => {
    s.off("conversation_update", callback);
  };
}
