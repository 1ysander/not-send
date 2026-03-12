import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function YoureSetScreen() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 overflow-hidden">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#bf5af2]/12 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm text-center space-y-8 animate-scale-in">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-[26px] bg-brand-gradient shadow-xl">
            <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10" aria-hidden>
              <path
                d="M10 20l7 7 13-14"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Copy */}
        <div className="space-y-3">
          <h1 className="text-[32px] font-bold tracking-tight text-foreground">
            You're protected.
          </h1>
          <p className="text-[15px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
            When you want to text them, open NOTSENT and type here instead.
            We'll step in before it sends — every time.
          </p>
        </div>

        <Button
          onClick={() => navigate("/")}
          size="lg"
          className="w-full"
        >
          Open NOTSENT
        </Button>
      </div>
    </div>
  );
}
