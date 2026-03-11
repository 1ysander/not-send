import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";

/** Shown in main panel when no conversation is selected. */
export function ChatEmpty() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <div className="rounded-xl bg-muted p-6 shadow-card">
        <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-medium">Select a conversation</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Choose a contact from the sidebar, or add one to get started.
      </p>
      <button
        type="button"
        onClick={() => navigate("/contacts")}
        className="mt-6 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium shadow-card transition-colors hover:bg-accent/50"
      >
        Add contact
      </button>
    </div>
  );
}
