import { useNavigate } from "react-router-dom";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/Container";

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
    <div className="min-h-screen bg-background py-12 sm:py-16">
      <Container narrow className="flex flex-col items-center">
        <Card className="w-full max-w-md rounded-xl shadow-card">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold tracking-tight">NOTSENT</CardTitle>
            <CardDescription>
              Sign in with your Google account to sync and secure your data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
              <p className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-center text-sm text-muted-foreground">
                Google Sign-In is not configured. Set{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  VITE_GOOGLE_CLIENT_ID
                </code>{" "}
                in your environment.
              </p>
            )}
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => navigate("/", { replace: true })}
            >
              Continue without account
            </Button>
          </CardContent>
        </Card>
      </Container>
    </div>
  );
}
