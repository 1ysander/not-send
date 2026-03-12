import { useNavigate } from "react-router-dom";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

export function LoginScreen() {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();

  const handleCredentialResponse = (response: CredentialResponse) => {
    const credential = response.credential;
    if (credential) {
      signIn(credential);
      navigate("/", { replace: true });
    }
  };

  if (user) {
    navigate("/", { replace: true });
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            NOTSENT
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Sign in to continue
          </h1>
          <p className="text-sm text-muted-foreground">
            Sync and secure your intervention history.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          {GOOGLE_CLIENT_ID ? (
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleCredentialResponse}
                onError={() => {}}
                useOneTap={false}
                theme="filled_black"
                size="large"
                text="signin_with"
                shape="rectangular"
              />
            </div>
          ) : (
            <p className="rounded-lg bg-secondary px-4 py-3 text-center text-sm text-muted-foreground">
              Set{" "}
              <code className="font-mono text-xs">VITE_GOOGLE_CLIENT_ID</code>{" "}
              in your environment to enable Google Sign-In.
            </p>
          )}
          <Button
            variant="ghost"
            className="w-full text-sm text-muted-foreground"
            onClick={() => navigate("/", { replace: true })}
          >
            Continue without account
          </Button>
        </div>
      </div>
    </div>
  );
}
