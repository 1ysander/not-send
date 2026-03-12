import { useNavigate } from "react-router-dom";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { supabaseEnabled } from "@/lib/supabase";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 overflow-hidden">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#bf5af2]/10 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-[#ff375f]/8 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-up space-y-10">
        {/* Wordmark + hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-[22px] bg-brand-gradient shadow-lg mb-2">
            <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8" aria-hidden>
              <path
                d="M16 4C10.477 4 6 8.477 6 14c0 3.09 1.373 5.858 3.556 7.74L8 28l6.26-1.556A9.95 9.95 0 0016 26c5.523 0 10-4.477 10-10S21.523 4 16 4z"
                fill="white"
                opacity="0.9"
              />
            </svg>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            NOTSENT
          </p>
          <h1 className="text-[32px] font-bold tracking-tight text-foreground leading-none">
            Before you send it.
          </h1>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            The space between impulse and send — where healing happens.
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}

export function LoginScreen() {
  const navigate       = useNavigate();
  const { signIn, user } = useAuth();

  if (user) {
    navigate("/", { replace: true });
    return null;
  }

  // Supabase OAuth path
  if (supabaseEnabled) {
    return (
      <LoginLayout>
        <div className="rounded-2xl border border-border/60 bg-card shadow-md overflow-hidden">
          <div className="p-6">
            <Button className="w-full" onClick={() => signIn()}>
              Continue with Google
            </Button>
          </div>
          <div className="border-t border-border bg-secondary/50 px-6 py-3">
            <p className="text-center text-[12px] text-muted-foreground">
              Your conversations never leave your device.
            </p>
          </div>
        </div>
      </LoginLayout>
    );
  }

  // Legacy path: @react-oauth/google inline button
  const handleCredentialResponse = (response: CredentialResponse) => {
    if (response.credential) {
      signIn(response.credential);
      navigate("/", { replace: true });
    }
  };

  return (
    <LoginLayout>
      <div className="rounded-2xl border border-border/60 bg-card shadow-md overflow-hidden">
        <div className="p-6 space-y-4">
          {GOOGLE_CLIENT_ID ? (
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleCredentialResponse}
                onError={() => {}}
                useOneTap={false}
                theme="filled_black"
                size="large"
                text="signin_with"
                shape="pill"
              />
            </div>
          ) : (
            <p className="rounded-xl bg-secondary px-4 py-3 text-center text-[13px] text-muted-foreground">
              Set{" "}
              <code className="font-mono text-xs">VITE_GOOGLE_CLIENT_ID</code>{" "}
              to enable Google Sign-In.
            </p>
          )}

          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[12px] text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            variant="secondary"
            size="default"
            className="w-full"
            onClick={() => navigate("/", { replace: true })}
          >
            Continue without account
          </Button>
        </div>

        <div className="border-t border-border bg-secondary/50 px-6 py-3">
          <p className="text-center text-[12px] text-muted-foreground">
            Your conversations never leave your device.
          </p>
        </div>
      </div>
    </LoginLayout>
  );
}
