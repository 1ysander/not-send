import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export function YoureSetScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center space-y-8">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-muted">
            <ShieldCheck className="h-7 w-7 text-brand" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">You're set</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            When you want to text them, open NOTSENT and type here instead. We'll intercept send and start a calm conversation so you process the impulse first.
          </p>
        </div>
        <Button
          onClick={() => navigate("/")}
          size="lg"
          className="w-full h-12"
        >
          Open NOTSENT
        </Button>
      </div>
    </div>
  );
}
