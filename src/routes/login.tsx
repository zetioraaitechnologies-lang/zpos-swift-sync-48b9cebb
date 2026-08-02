import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { bootstrapSuperAdmin } from "@/lib/admin.functions";
import loginBg from "@/assets/zpos-login-bg.png.asset.json";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — ZPOS" },
      {
        name: "description",
        content:
          "Sign in to ZPOS. Closed cloud-synced Point of Sale by Zetiora AI — accounts are issued by administrators.",
      },
      { property: "og:title", content: "Sign in — ZPOS" },
      { property: "og:description", content: "Secure login to the ZPOS business platform." },
    ],
  }),
  component: Login,
});

function Login() {
  const { login, user, ready } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showBootstrap, setShowBootstrap] = useState(false);

  useEffect(() => {
    if (ready && user) {
      nav({ to: user.role === "super_admin" ? "/admin" : "/dashboard" });
    }
  }, [ready, user, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const r = await login(email.trim(), pw);
      if (!r.ok) setErr(r.error ?? "Login failed");
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
        <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--navy-deep)] via-[color:var(--navy)]/80 to-[color:var(--navy)]/20" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center bg-gold-gradient clip-cut-sm">
              <span className="font-display text-xl font-bold text-on-accent">Z</span>
            </div>
            <div>
              <div className="font-display text-2xl font-bold tracking-widest text-gold">ZPOS</div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">Smart · Simple · Powerful</div>
            </div>
          </div>
          <div>
            <h1 className="font-display text-5xl font-bold leading-tight text-white">
              Run your business
              <br />
              <span className="text-gold">without limits.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-white/80">
              Accounts are issued by your administrator. Sign in with the credentials
              you were given — your data syncs across every device automatically.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.25em] text-white/60">
            Powered by <span className="text-gold">Zetiora AI Technologies</span>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 top-0 h-56 overflow-hidden lg:hidden">
        <img src={loginBg.url} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-[color:var(--navy-deep)] via-[color:var(--navy)]/70 to-background" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="grid h-14 w-14 place-items-center bg-gold-gradient clip-cut-sm">
            <span className="font-display text-2xl font-bold text-on-accent">Z</span>
          </div>
          <div className="font-display text-3xl font-bold tracking-widest text-gold">ZPOS</div>
        </div>
      </div>

      <div className="relative z-10 flex w-full items-start justify-center px-5 pb-10 pt-64 sm:pt-72 lg:w-[520px] lg:items-center lg:px-6 lg:pt-10">
        <div className="relative w-full max-w-md">
          <div className="panel p-6 clip-cut-card sm:p-8">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Sign in
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome back. Enter the credentials issued by your administrator.
            </p>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-none border border-border bg-input py-2.5 pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-[color:var(--gold)] focus:ring-2 focus:ring-[color:var(--gold)]/20"
                    placeholder="you@business.com"
                  />
                </div>
              </div>
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
                    autoComplete="current-password"
                    className="w-full rounded-none border border-border bg-input py-2.5 pl-10 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-[color:var(--gold)] focus:ring-2 focus:ring-[color:var(--gold)]/20"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-none p-1 text-muted-foreground hover:text-gold"
                    aria-label="Toggle password"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {err && (
                <div className="rounded-none border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {err}
                </div>
              )}

              <GoldButton type="submit" variant="navy" size="lg" className="w-full" disabled={loading}>
                {loading ? "Please wait…" : "Sign in →"}
              </GoldButton>
            </form>

            <div className="mt-6 rounded-none border border-border bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
              This is a closed system. Owners are created by the ZPOS super admin.
              Cashiers are created by their business owner. Need credentials? Contact your admin.
            </div>

            <button
              type="button"
              onClick={() => setShowBootstrap((v) => !v)}
              className="mt-4 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-gold"
            >
              <ShieldCheck className="h-3 w-3" /> Super-admin first-run setup
            </button>

            {showBootstrap && <BootstrapPanel onDone={() => setShowBootstrap(false)} />}
          </div>

          <div className="mt-6 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            © {new Date().getFullYear()} Zetiora AI Technologies
          </div>
        </div>
      </div>
    </div>
  );
}

function BootstrapPanel({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("zetioraaitechnologies@gmail.com");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await bootstrapSuperAdmin({ data: { email, password: pw } });
      if (r.existed) toast.info("Super admin already exists. Just sign in above.");
      else toast.success("Super admin created. Sign in above.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bootstrap failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={go} className="mt-3 space-y-3 rounded-none border border-[color:var(--gold)]/30 bg-secondary p-3">
      <p className="text-[11px] text-muted-foreground">
        Run once to seed the allow-listed super-admin account. Ignored if it already exists.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
      />
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        required
        minLength={8}
        placeholder="Set super-admin password (min 8)"
        className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
      />
      <GoldButton type="submit" size="sm" className="w-full" disabled={busy}>
        {busy ? "Working…" : "Seed super admin"}
      </GoldButton>
    </form>
  );
}
