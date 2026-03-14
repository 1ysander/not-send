import { useState } from "react";
import { Link } from "react-router-dom";

export function EnterpriseScreen() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 flex items-center">
        <Link
          to="/"
          className="text-[#f5f5f5] text-lg font-semibold tracking-tight hover:opacity-80 transition-opacity"
        >
          NOTSENT
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div
          className="w-full max-w-md rounded-2xl border p-8 flex flex-col gap-6"
          style={{ background: "#111111", borderColor: "rgba(255,255,255,0.08)" }}
        >
          {/* Badge */}
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#bf5af2] bg-[#bf5af2]/10 px-3 py-1 rounded-full">
              Enterprise
            </span>
          </div>

          {/* Headline */}
          <div className="flex flex-col gap-3">
            <h1 className="text-2xl font-bold leading-tight text-[#f5f5f5]">
              Compliance scanning for teams.
            </h1>
            <p className="text-sm leading-relaxed text-[#6b6b6b]">
              Flag legal liability, harassment, GDPR leakage, and tone issues before messages leave
              your company. Coming soon.
            </p>
          </div>

          {/* Feature list */}
          <ul className="flex flex-col gap-3">
            {[
              "Real-time outbound message scanning",
              "Legal liability and harassment detection",
              "GDPR & data leakage flags",
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-[#f5f5f5]">
                <span className="mt-0.5 shrink-0 text-[#bf5af2]">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="8" cy="8" r="8" fill="#bf5af2" fillOpacity="0.15" />
                    <path
                      d="M4.5 8.5L7 11L11.5 5.5"
                      stroke="#bf5af2"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {feature}
              </li>
            ))}
          </ul>

          {/* Waitlist form */}
          {submitted ? (
            <div className="rounded-xl border border-[#bf5af2]/30 bg-[#bf5af2]/5 px-4 py-4 text-sm text-[#f5f5f5]">
              You're on the list. We'll reach out when enterprise opens.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
              <input
                type="email"
                placeholder="Work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border bg-[#0a0a0a] px-4 py-3 text-sm text-[#f5f5f5] placeholder-[#6b6b6b] outline-none focus:border-[#bf5af2]/60 transition-colors"
                style={{ borderColor: "rgba(255,255,255,0.10)" }}
                aria-label="Work email"
              />
              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}
              <button
                type="submit"
                className="w-full rounded-xl bg-[#bf5af2] px-4 py-3 text-sm font-semibold text-white hover:bg-[#bf5af2]/90 active:bg-[#bf5af2]/80 transition-colors"
              >
                Join waitlist
              </button>
              <p className="text-center text-xs text-[#6b6b6b]">
                No spam. For teams and compliance officers.
              </p>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-5 text-center">
        <p className="text-xs text-[#6b6b6b]">
          Private product by NOTSENT — for teams that need to protect what gets sent.
        </p>
      </footer>
    </div>
  );
}
