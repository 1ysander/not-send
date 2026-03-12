import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/Container";
import { ChevronLeft } from "lucide-react";
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
      {/* Frosted glass header */}
      <header className="sticky top-0 z-10 glass flex flex-shrink-0 items-center h-14 gap-2 border-b px-4 sm:px-5">
        {backTo != null ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate(backTo)}
            aria-label="Back"
            className="text-brand -ml-1"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
          </Button>
        ) : (
          <div className="w-7" />
        )}
        <h1 className="flex-1 text-[17px] font-semibold tracking-tight text-foreground">
          {title}
        </h1>
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
