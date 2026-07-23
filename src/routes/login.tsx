import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff, Phone } from "lucide-react";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import loginBg from "@/assets/zpos-login-bg.png.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — ZPOS" },
      {
        name: "description",
        content:
          "Sign in to ZPOS. Secure business login for owners and cashiers on the Zetiora AI platform.",
      },
      { property: "og:title", content: "Sign in — ZPOS" },
      {
        property: "og:description",
        content: "Secure login to the ZPOS business platform.",
      },
    ],
  }),
  component: Login,
});

// Phone-only users get a synthesized local email under the hood.
export function phoneToLocalEmail(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return `${digits}@local.zpos`;
}

function Login() {
  const { login, user, ready } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) {
      nav({ to: user.role === "super_admin" ? "/admin" : "/dashboard" });
    }
  }, [ready, user, nav]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    // Phone mode: try phone directly, and also try synthesized local email
    // so phone-only accounts (no real email) still resolve.
    let r = login(id.trim(), pw);
    if (!r.ok && mode === "phone") {
      r = login(phoneToLocalEmail(id.trim()), pw);
    }
    setLoading(false);
    if (!r.ok) {
      setErr(r.error ?? "Login failed");
      return;
    }
    void remember;
  };

  return (
    <div className="relative flex min-h-screen items-stretch bg-background text-foreground">
      {/* Left visual — desktop */}
      <div
        className="relative hidden flex-1 bg-cover bg-center lg:block"
        style={{ backgroundImage: `url(${loginBg.url})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/10" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center bg-gold-gradient clip-cut-sm">
              <span className="font-display text-xl font-black text-black">Z</span>
            </div>
            <div>
              <div className="font-display text-2xl font-black tracking-widest text-gold">
                ZPOS
              </div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">
                Smart · Simple · Powerful
              </div>
            </div>
          </div>
          <div>
            <h1 className="font-display text-5xl font-black leading-tight text-white">
              Run your business
              <br />
              <span className="text-gold">without limits.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-white/80">
              Sell, track stock, manage customers and grow — even when the internet
              goes down. ZPOS keeps your business moving.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.25em] text-white/60">
            Powered by <span className="text-gold">Zetiora AI Technologies</span>
          </div>
        </div>
      </div>

      {/* Mobile hero banner */}
      <div className="absolute inset-x-0 top-0 h-56 overflow-hidden lg:hidden">
        <img
          src={loginBg.url}
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-background" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="grid h-14 w-14 place-items-center bg-gold-gradient clip-cut-sm">
            <span className="font-display text-2xl font-black text-black">Z</span>
          </div>
          <div className="font-display text-3xl font-black tracking-widest text-gold">
            ZPOS
          </div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/80">
            Smart · Simple · Powerful
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="relative z-10 flex w-full items-start justify-center px-5 pb-10 pt-64 sm:pt-72 lg:w-[520px] lg:items-center lg:px-6 lg:pt-10">
        <div className="relative w-full max-w-md">
          <div className="panel p-6 clip-cut-card sm:p-8">
            <h2 className="font-display text-2xl font-black uppercase tracking-wider text-gold">
              Sign in
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome back. Enter your business credentials.
            </p>

            {/* Mode toggle */}
            <div className="mt-5 grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/60 p-1">
              <button
                type="button"
                onClick={() => setMode("email")}
                className={`rounded px-3 py-2 text-xs font-semibold uppercase tracking-widest transition ${
                  mode === "email"
                    ? "bg-gold-gradient text-black shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => setMode("phone")}
                className={`rounded px-3 py-2 text-xs font-semibold uppercase tracking-widest transition ${
                  mode === "phone"
                    ? "bg-gold-gradient text-black shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Phone
              </button>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {mode === "email" ? "Email address" : "Phone number"}
                </label>
                <div className="relative">
                  {mode === "email" ? (
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  ) : (
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  )}
                  <input
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    required
                    type={mode === "phone" ? "tel" : "email"}
                    inputMode={mode === "phone" ? "tel" : "email"}
                    autoComplete={mode === "phone" ? "tel" : "username"}
                    className="w-full rounded-md border border-border bg-input/60 py-2.5 pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[color:var(--gold)] focus:ring-2 focus:ring-[color:var(--gold)]/20"
                    placeholder={mode === "phone" ? "0712 345 678" : "you@business.com"}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={show ? "text" : "password"}
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full rounded-md border border-border bg-input/60 py-2.5 pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[color:var(--gold)] focus:ring-2 focus:ring-[color:var(--gold)]/20"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-gold"
                    aria-label="Toggle password"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[color:var(--gold)]"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      "Please contact your system administrator at Zetiora AI to reset your password.",
                    )
                  }
                  className="font-semibold uppercase tracking-widest text-gold hover:underline"
                >
                  Forgot?
                </button>
              </div>

              {err && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {err}
                </div>
              )}

              <GoldButton type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in →"}
              </GoldButton>
            </form>

            <div className="mt-6 rounded-md border border-border bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
              No account? ZPOS is a closed platform — accounts are created by
              your system administrator.
            </div>
          </div>

          <div className="mt-6 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            © {new Date().getFullYear()} Zetiora AI Technologies
          </div>
        </div>
      </div>
    </div>
  );
}
