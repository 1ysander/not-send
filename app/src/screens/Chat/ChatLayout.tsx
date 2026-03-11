import { Outlet } from "react-router-dom";
import { ConversationSidebar } from "./ConversationSidebar";

/**
 * Chat layout: sidebar (conversations) | main panel (messages) | compose box.
 * Main panel and compose are rendered by child routes (ChatPanel or ChatEmpty).
 */
export function ChatLayout() {
  return (
    <div className="flex h-full min-h-0 w-full flex-row bg-background">
      <ConversationSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
