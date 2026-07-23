import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Cloud, CloudUpload, CloudDownload, LogOut } from "lucide-react";
import { GoldButton } from "@/components/zpos/gold-button";
import {
  cloudGetUser,
  cloudSignIn,
  cloudSignUp,
  cloudSignOut,
  cloudPush,
  cloudPull,
  cloudLastBackupAt,
  type CloudUser,
} from "@/lib/zpos-cloud";
import { supabase } from "@/integrations/supabase/client";

export function CloudSyncPanel() {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [lastAt, setLastAt] = useState<string | null>(null);

  const refresh = async () => {
    const u = await cloudGetUser();
    setUser(u);
    if (u) setLastAt(await cloudLastBackupAt());
  };

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        await cloudSignUp(email.trim(), password);
        toast.success("Cloud account created. Check your email if confirmation is required.");
      } else {
        await cloudSignIn(email.trim(), password);
        toast.success("Signed in to cloud");
      }
      setPassword("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const push = async () => {
    setBusy(true);
    try {
      const r = await cloudPush();
      setLastAt(r.updatedAt);
      toast.success("Backed up to cloud");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pull = async () => {
    if (!confirm("This will replace all local data with the cloud backup. Continue?")) return;
    setBusy(true);
    try {
      const r = await cloudPull();
      if (!r) toast.message("No cloud backup found yet");
      else {
        setLastAt(r.updatedAt);
        toast.success("Cloud data restored");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel clip-cut-card space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4 text-gold" />
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-gold">
          Cloud Sync
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Back up all offline data (products, sales, customers, expenses, logo & receipt images)
        to the cloud. Restore on any device by signing in with the same email.
      </p>

      {!user ? (
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`rounded-md border px-3 py-1.5 uppercase tracking-widest ${mode === "signin" ? "border-gold text-gold" : "border-white/10 text-muted-foreground"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-md border px-3 py-1.5 uppercase tracking-widest ${mode === "signup" ? "border-gold text-gold" : "border-white/10 text-muted-foreground"}`}
            >
              Create account
            </button>
          </div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-gold/60"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 chars)"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-gold/60"
          />
          <GoldButton type="submit" disabled={busy}>
            {mode === "signup" ? "Create cloud account" : "Sign in"}
          </GoldButton>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-white/10 bg-black/40 p-3 text-xs">
            <div className="text-muted-foreground">Signed in as</div>
            <div className="font-semibold text-gold">{user.email}</div>
            {lastAt && (
              <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                Last backup: {new Date(lastAt).toLocaleString()}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={push}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold/20 disabled:opacity-50"
            >
              <CloudUpload className="h-3.5 w-3.5" /> Back up now
            </button>
            <button
              type="button"
              onClick={pull}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest hover:bg-white/5 disabled:opacity-50"
            >
              <CloudDownload className="h-3.5 w-3.5" /> Restore from cloud
            </button>
            <button
              type="button"
              onClick={async () => {
                await cloudSignOut();
                toast.message("Signed out of cloud");
              }}
              className="inline-flex items-center gap-2 rounded-md border border-red-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-red-300 hover:bg-red-500/10"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
