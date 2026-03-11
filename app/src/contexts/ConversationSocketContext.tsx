import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onConversationUpdate, type ConversationUpdatePayload } from "@/socket";

type UpdatesBySession = Record<string, ConversationUpdatePayload["messages"]>;

type ContextValue = {
  /** Latest messages per sessionId from server (conversation_update). */
  updatesBySession: UpdatesBySession;
  /** Get messages for a session (from live updates). */
  getMessages: (sessionId: string) => ConversationUpdatePayload["messages"] | undefined;
  /** Incremented when any conversation_update is received (for triggering refetches). */
  updateVersion: number;
};

const ConversationSocketContext = createContext<ContextValue | null>(null);

export function ConversationSocketProvider({ children }: { children: ReactNode }) {
  const [updatesBySession, setUpdatesBySession] = useState<UpdatesBySession>({});
  const [updateVersion, setUpdateVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = onConversationUpdate((payload) => {
      setUpdatesBySession((prev) => ({
        ...prev,
        [payload.sessionId]: payload.messages,
      }));
      setUpdateVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  const getMessages = useCallback((sessionId: string) => {
    return updatesBySession[sessionId];
  }, [updatesBySession]);

  const value = useMemo<ContextValue>(
    () => ({ updatesBySession, getMessages, updateVersion }),
    [updatesBySession, getMessages, updateVersion]
  );

  return (
    <ConversationSocketContext.Provider value={value}>
      {children}
    </ConversationSocketContext.Provider>
  );
}

export function useConversationSocket(): ContextValue {
  const ctx = useContext(ConversationSocketContext);
  if (!ctx) {
    throw new Error("useConversationSocket must be used within ConversationSocketProvider");
  }
  return ctx;
}

export function useConversationSocketOptional(): ContextValue | null {
  return useContext(ConversationSocketContext);
}
