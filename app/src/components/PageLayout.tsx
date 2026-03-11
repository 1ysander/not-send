import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/Container";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  title: string;
  backTo?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Shared layout for tab pages: header with optional back + title + action, then content in max-width container. */
export function PageLayout({ title, backTo, right, children, className }: PageLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <header className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-border bg-card/50 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {backTo != null ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(backTo)}
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <span className="w-10" />
          )}
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        </div>
        {right != null && <div className="flex-shrink-0">{right}</div>}
      </header>
      <div className="flex-1 overflow-y-auto py-8 sm:py-10">
        <Container bare narrow contentClassName="space-y-6">
          {children}
        </Container>
      </div>
    </div>
  );
}
