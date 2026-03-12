import { useRef, type FormEvent } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Sticky input bar: textarea + send button. Claude-style at bottom of chat.
 */
export function InputBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Message",
  disabled = false,
  className,
}: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  }

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex-shrink-0 border-t border-border bg-background px-4 py-4",
        className
      )}
    >
      <div className="mx-auto flex max-w-xl items-end gap-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "min-h-[44px] max-h-[200px] w-full resize-none rounded-xl border border-border bg-secondary px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground",
            "outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 disabled:opacity-50"
          )}
          aria-label="Message"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className={cn(
            "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
            canSend
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "bg-secondary text-muted-foreground cursor-not-allowed"
          )}
        >
          <Send className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}
