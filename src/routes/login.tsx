import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff, Building2 } from "lucide-react";
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
          "Sign in to ZPOS or register your business. Secure cloud-synced Point of Sale by Zetiora AI.",
      },
      { property: "og:title", content: "Sign in — ZPOS" },
      { property: "og:description", content: "Secure login to the ZPOS business platform." },
    ],
  }),
  component: Login,
});

function Login() {
  const { login, signUpOwner, user, ready } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) {
      nav({ to: user.role === "super_admin" ? "/admin" : "/dashboard" });
    }
  }, [ready, user, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const r = await signUpOwner({
          email: email.trim(),
          password: pw,
          ownerName,
          businessName,
          phone,
        });
        if (!r.ok) setErr(r.error ?? "Sign up failed");
        else if (r.error) setMsg(r.error);
      } else {
        const r = await login(email.trim(), pw);
        if (!r.ok) setErr(r.error ?? "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-stretch bg-background text-foreground">
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
              <div className="font-display text-2xl font-black tracking-widest text-gold">ZPOS</div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">Smart · Simple · Powerful</div>
            </div>
          </div>
          <div>
            <h1 className="font-display text-5xl font-black leading-tight text-white">
              Run your business
              <br />
              <span className="text-gold">without limits.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-white/80">
              Sell, track stock, manage customers and grow — your data syncs
              across every device and every staff member automatically.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.25em] text-white/60">
            Powered by <span className="text-gold">Zetiora AI Technologies</span>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 top-0 h-56 overflow-hidden lg:hidden">
        <img src={loginBg.url} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-background" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="grid h-14 w-14 place-items-center bg-gold-gradient clip-cut-sm">
            <span className="font-display text-2xl font-black text-black">Z</span>
          </div>
          <div className="font-display text-3xl font-black tracking-widest text-gold">ZPOS</div>
        </div>
      </div>

      <div className="relative z-10 flex w-full items-start justify-center px-5 pb-10 pt-64 sm:pt-72 lg:w-[520px] lg:items-center lg:px-6 lg:pt-10">
        <div className="relative w-full max-w-md">
          <div className="panel p-6 clip-cut-card sm:p-8">
            <h2 className="font-display text-2xl font-black uppercase tracking-wider text-gold">
              {mode === "signup" ? "Register your business" : "Sign in"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signup"
                ? "Create your ZPOS account and business profile."
                : "Welcome back. Enter your credentials."}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/60 p-1">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setErr(""); setMsg(""); }}
                  className={`rounded px-3 py-2 text-xs font-semibold uppercase tracking-widest transition ${
                    mode === m ? "bg-gold-gradient text-black shadow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Register business"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4">
              {mode === "signup" && (
                <>
                  <LabeledInput label="Business Name" icon={<Building2 className="h-4 w-4" />} value={businessName} onChange={setBusinessName} required />
                  <LabeledInput label="Your Name" value={ownerName} onChange={setOwnerName} required />
                  <LabeledInput label="Phone (optional)" value={phone} onChange={setPhone} type="tel" />
                </>
              )}
              <LabeledInput label="Email" icon={<Mail className="h-4 w-4" />} value={email} onChange={setEmail} type="email" required autoComplete="username" />
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={show ? "text" : "password"}
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="w-full rounded-md border border-border bg-input/60 py-2.5 pl-10 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-[color:var(--gold)] focus:ring-2 focus:ring-[color:var(--gold)]/20"
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

              {err && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {err}
                </div>
              )}
              {msg && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  {msg}
                </div>
              )}

              <GoldButton type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Please wait…" : mode === "signup" ? "Create account →" : "Sign in →"}
              </GoldButton>
            </form>

            <div className="mt-6 rounded-md border border-border bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {mode === "signup"
                ? "You'll become the owner of your business. Add cashiers later from Employees."
                : "Cashiers use credentials given by their business owner."}
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

function LabeledInput({
  label, value, onChange, type = "text", required, autoComplete, icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          type={type}
          autoComplete={autoComplete}
          className={`w-full rounded-md border border-border bg-input/60 py-2.5 ${icon ? "pl-10" : "pl-3"} pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-[color:var(--gold)] focus:ring-2 focus:ring-[color:var(--gold)]/20`}
        />
      </div>
    </div>
  );
}
