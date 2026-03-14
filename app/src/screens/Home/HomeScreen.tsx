import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    number: "01",
    title: "Upload",
    description: "Export your iMessage conversation from your iPhone and upload the .txt file. Stays private.",
  },
  {
    number: "02",
    title: "Intercept",
    description: "Type the message you were going to send. The AI reads it, knows the relationship, and talks you through it.",
  },
  {
    number: "03",
    title: "Move on",
    description: "Have the conversation you never got, get closure, and break the loop — without reaching out.",
  },
];

export function HomeScreen() {
  const navigate = useNavigate();

  return (
    <div
      className="relative flex flex-col min-h-screen overflow-x-hidden"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      {/* Ambient background glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full opacity-15 blur-3xl"
          style={{ background: "radial-gradient(circle, #bf5af2 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-1/2 -right-32 h-80 w-80 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #ff375f 0%, transparent 70%)" }}
        />
      </div>

      {/* Sticky header bar */}
      <header
        className="relative z-20 flex items-center justify-between px-6 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#6b6b6b" }}>
          NOTSENT
        </p>
        <button
          data-testid="header-sign-in"
          className="text-sm font-medium min-h-[44px] min-w-[44px] flex items-center px-3"
          style={{ color: "#bf5af2" }}
          onClick={() => navigate("/login")}
        >
          Sign in
        </button>
      </header>

      {/* Hero section */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-16 pb-20 flex-1">
        <div className="max-w-2xl mx-auto flex flex-col gap-7">
          {/* Eyebrow */}
          <p
            className="text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "#bf5af2" }}
          >
            Stop. Don't send it.
          </p>

          {/* Headline */}
          <h1
            className="text-[40px] sm:text-[58px] font-bold tracking-tight leading-[1.05]"
            style={{ color: "#f5f5f5" }}
          >
            You have a message{" "}
            <span
              className="italic"
              style={{
                background: "linear-gradient(90deg, #bf5af2, #ff375f)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              drafted.
            </span>
            <br />
            Don't send it.
          </h1>

          {/* Subheadline */}
          <p
            className="text-[16px] sm:text-[18px] leading-relaxed max-w-lg mx-auto"
            style={{ color: "#6b6b6b" }}
          >
            Upload your iMessage conversation. The AI learns them — their tone, their words, their patterns —
            then helps you process the urge without making contact.
          </p>

          {/* Primary CTA */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button
              data-testid="hero-upload-cta"
              className="w-full sm:w-auto min-h-[52px] px-8 text-base font-semibold rounded-2xl text-white"
              style={{ backgroundColor: "#bf5af2" }}
              onClick={() => navigate("/login")}
            >
              Upload your conversation
            </Button>
            <p className="text-[12px]" style={{ color: "#6b6b6b" }}>
              Free. Private. No account required to try.
            </p>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section
        className="relative z-10 px-6 py-16 w-full"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="max-w-2xl mx-auto flex flex-col gap-12">
          {/* Section label */}
          <div className="text-center">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: "#6b6b6b" }}
            >
              How it works
            </p>
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-8">
            {STEPS.map((step) => (
              <div key={step.number} className="flex gap-5 items-start">
                {/* Step number */}
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-bold tracking-wider"
                  style={{
                    backgroundColor: "rgba(191,90,242,0.12)",
                    color: "#bf5af2",
                    border: "1px solid rgba(191,90,242,0.2)",
                  }}
                >
                  {step.number}
                </div>

                {/* Content */}
                <div className="flex flex-col gap-1 pt-1">
                  <h3 className="text-[17px] font-semibold" style={{ color: "#f5f5f5" }}>
                    {step.title}
                  </h3>
                  <p className="text-[14px] leading-relaxed" style={{ color: "#6b6b6b" }}>
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Secondary CTA */}
          <div className="text-center">
            <Button
              data-testid="how-it-works-cta"
              variant="outline"
              className="min-h-[48px] px-8 text-sm font-semibold rounded-2xl"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                color: "#f5f5f5",
                backgroundColor: "transparent",
              }}
              onClick={() => navigate("/login")}
            >
              Get started — it's free
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative z-10 px-6 py-8 text-center"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <p className="text-[11px] uppercase tracking-[0.2em] font-bold mb-2" style={{ color: "#6b6b6b" }}>
          NOTSENT
        </p>
        <p className="text-[12px]" style={{ color: "#6b6b6b" }}>
          Private &amp; confidential. We don't store your messages.
        </p>
      </footer>
    </div>
  );
}
