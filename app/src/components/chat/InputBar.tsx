import { useRef, type FormEvent } from "react";
import { ArrowUp } from "lucide-react";
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
 * Sticky input bar: pill textarea + round send button. iMessage-style.
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
        "flex-shrink-0 border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3 pb-safe",
        className
      )}
    >
      <div className="mx-auto flex max-w-xl items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "min-h-[40px] max-h-[160px] w-full resize-none",
              "rounded-[22px] border border-border bg-secondary",
              "px-4 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground/60",
              "outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all",
              "disabled:opacity-50 leading-relaxed"
            )}
            aria-label="Message"
            style={{ overflowY: value.split('\n').length > 3 ? 'auto' : 'hidden' }}
          />
        </div>
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200",
            canSend
              ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-90 shadow-sm"
              : "bg-secondary text-muted-foreground/40 cursor-not-allowed"
          )}
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </form>
  );
}
