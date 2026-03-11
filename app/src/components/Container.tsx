import { cn } from "@/lib/utils";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Inner content area class (applied to the max-w-content div). */
  contentClassName?: string;
  /** Tighter max-width for form/content (56rem). Default is 80rem. */
  narrow?: boolean;
  /** Only render inner content (no outer min-h-screen wrapper). Use inside PageLayout. */
  bare?: boolean;
}

/** Page container: full-height background + centered content (messaging app layout). */
export function Container({
  children,
  className,
  contentClassName,
  narrow,
  bare,
}: ContainerProps) {
  const inner = (
    <div
      className={cn(
        "mx-auto w-full px-6 py-10",
        narrow ? "max-w-content" : "max-w-container",
        contentClassName
      )}
    >
      {children}
    </div>
  );
  if (bare) return inner;
  return (
    <div className={cn("min-h-screen bg-background text-foreground", className)}>
      {inner}
    </div>
  );
}
