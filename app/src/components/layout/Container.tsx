import { cn } from "@/lib/utils";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Tighter max-width for form/content (896px). Default is 1280px. */
  narrow?: boolean;
}

/** Max-width container with consistent horizontal padding (SaaS convention). */
export function Container({ children, className, narrow }: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        narrow ? "max-w-content" : "max-w-container",
        className
      )}
    >
      {children}
    </div>
  );
}
