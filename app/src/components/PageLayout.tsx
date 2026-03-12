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

export function PageLayout({ title, backTo, right, children, className }: PageLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <header className="flex flex-shrink-0 items-center h-14 gap-3 border-b border-border bg-background px-4 sm:px-6">
        {backTo != null ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(backTo)}
            aria-label="Back"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <div className="w-8" />
        )}
        <h1 className="flex-1 text-sm font-semibold tracking-tight text-foreground">{title}</h1>
        {right != null && <div className="flex-shrink-0">{right}</div>}
      </header>
      <div className="flex-1 overflow-y-auto">
        <Container bare narrow contentClassName="py-6 space-y-5">
          {children}
        </Container>
      </div>
    </div>
  );
}
