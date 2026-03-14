import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { supabaseEnabled } from "@/lib/supabase";
import { hasCompletedOnboarding, setProductMode } from "@/lib/storage";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

export function LoginScreen() {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  const [enterpriseEmail, setEnterpriseEmail] = useState("");
  const [enterpriseSubmitted, setEnterpriseSubmitted] = useState(false);
  const [enterpriseError, setEnterpriseError] = useState("");
  const [isSubmittingEnterprise, setIsSubmittingEnterprise] = useState(false);

  if (user) {
    navigate(hasCompletedOnboarding() ? "/" : "/onboarding", { replace: true });
    return null;
  }

  async function handlePersonalSignIn() {
    setProductMode("personal");
    await signIn();
    // After OAuth redirect returns, AuthContext handles session, App.tsx routes to /onboarding or /
  }

  async function handleEnterpriseWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!enterpriseEmail.trim() || !enterpriseEmail.includes("@")) {
      setEnterpriseError("Please enter a valid email address.");
      return;
    }
    setIsSubmittingEnterprise(true);
    setEnterpriseError("");
    // No backend yet — just capture intent locally and show confirmation
    await new Promise((r) => setTimeout(r, 600));
    setProductMode("enterprise");
    setEnterpriseSubmitted(true);
    setIsSubmittingEnterprise(false);
  }

  // Legacy: @react-oauth/google credential handler (non-Supabase path)
  const handleCredentialResponse = (response: CredentialResponse) => {
    if (response.credential) {
      setProductMode("personal");
      signIn(response.credential);
      navigate(hasCompletedOnboarding() ? "/" : "/onboarding", { replace: true });
    }
  };

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-between px-4 py-12 overflow-hidden"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-60 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #bf5af2 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #ff375f 0%, transparent 70%)" }} />
      </div>

      {/* Header wordmark */}
      <div className="relative z-10 flex flex-col items-center gap-2 pt-4">
        <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#6b6b6b" }}>
          NOTSENT
        </p>
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center gap-10">
        {/* Headline */}
        <div className="text-center space-y-4 px-4">
          <h1
            className="text-[38px] sm:text-[52px] font-bold tracking-tight leading-none"
            style={{ color: "#f5f5f5" }}
          >
            What are you protecting?
          </h1>
          <p className="text-[16px] leading-relaxed max-w-md mx-auto" style={{ color: "#6b6b6b" }}>
            Choose which version of yourself needs help today.
          </p>
        </div>

        {/* Two cards */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 px-2">
          {/* Personal card */}
          <div
            className="flex flex-col rounded-2xl p-7 gap-6"
            style={{
              backgroundColor: "#111111",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex flex-col gap-3">
              <div className="text-2xl">💔</div>
              <h2 className="text-[22px] font-semibold leading-tight" style={{ color: "#f5f5f5" }}>
                Stop texting them.
              </h2>
              <p className="text-[14px] leading-relaxed" style={{ color: "#6b6b6b" }}>
                Breakup intervention, AI closure, and emotional support — grounded in your actual conversation.
                Upload your iMessage export and the AI learns their voice.
              </p>
            </div>

            <div className="mt-auto flex flex-col gap-3">
              {supabaseEnabled ? (
                <Button
                  data-testid="personal-google-btn"
                  className="w-full min-h-[44px] font-semibold text-white"
                  style={{ backgroundColor: "#bf5af2" }}
                  onClick={handlePersonalSignIn}
                >
                  Continue with Google
                </Button>
              ) : GOOGLE_CLIENT_ID ? (
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
                <Button
                  data-testid="personal-google-btn"
                  className="w-full min-h-[44px] font-semibold text-white"
                  style={{ backgroundColor: "#bf5af2" }}
                  onClick={() => {
                    setProductMode("personal");
                    navigate(hasCompletedOnboarding() ? "/" : "/onboarding", { replace: true });
                  }}
                >
                  Continue with Google
                </Button>
              )}
              <p className="text-center text-[11px]" style={{ color: "#6b6b6b" }}>
                For personal use
              </p>
            </div>
          </div>

          {/* Enterprise card */}
          <div
            className="flex flex-col rounded-2xl p-7 gap-6"
            style={{
              backgroundColor: "#111111",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex flex-col gap-3">
              <div className="text-2xl">🏢</div>
              <h2 className="text-[22px] font-semibold leading-tight" style={{ color: "#f5f5f5" }}>
                Protect your company from what gets sent.
              </h2>
              <p className="text-[14px] leading-relaxed" style={{ color: "#6b6b6b" }}>
                Compliance scanning, legal liability review, tone checking — for teams. Catch what should never
                have been sent before it leaves the building.
              </p>
            </div>

            <div className="mt-auto flex flex-col gap-3">
              {enterpriseSubmitted ? (
                <div
                  className="rounded-xl px-4 py-4 text-center"
                  style={{ backgroundColor: "rgba(191,90,242,0.1)", border: "1px solid rgba(191,90,242,0.2)" }}
                >
                  <p className="text-sm font-semibold" style={{ color: "#bf5af2" }}>
                    You're on the list.
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: "#6b6b6b" }}>
                    We'll reach out when enterprise access opens.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleEnterpriseWaitlist} className="flex flex-col gap-3">
                  <input
                    data-testid="enterprise-email-input"
                    type="email"
                    placeholder="Work email"
                    value={enterpriseEmail}
                    onChange={(e) => setEnterpriseEmail(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg px-4 text-sm outline-none placeholder:text-[#6b6b6b]"
                    style={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#f5f5f5",
                    }}
                  />
                  {enterpriseError && (
                    <p className="text-[12px]" style={{ color: "#ff453a" }}>
                      {enterpriseError}
                    </p>
                  )}
                  <Button
                    data-testid="enterprise-waitlist-btn"
                    type="submit"
                    variant="outline"
                    className="w-full min-h-[44px] font-semibold"
                    style={{
                      borderColor: "rgba(255,255,255,0.15)",
                      color: "#f5f5f5",
                      backgroundColor: "transparent",
                    }}
                    disabled={isSubmittingEnterprise}
                  >
                    {isSubmittingEnterprise ? "Joining…" : "Join waitlist"}
                  </Button>
                </form>
              )}
              <p className="text-center text-[11px]" style={{ color: "#6b6b6b" }}>
                For teams &amp; organizations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center">
        <p className="text-[12px]" style={{ color: "#6b6b6b" }}>
          Private &amp; confidential. We don't store your messages.
        </p>
      </div>
    </div>
  );
}
