import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { UserPlus, Ban, CheckCircle2 } from "lucide-react";
import { zdb, uid } from "@/lib/zpos-db";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { resolveIdentifiers } from "@/lib/zpos-identifiers";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/employees")({
  component: Employees,
});

function Employees() {
  const { org, user } = useAuth();
  const [, setV] = useState(0);
  useEffect(() => {
    const u = zdb.subscribe(() => setV((n) => n + 1));
    return () => { u(); };
  }, []);
  const [show, setShow] = useState(false);

  if (!org || user?.role !== "owner") {
    return (
      <div className="panel clip-cut-card p-8 text-center text-muted-foreground">
        Only the Owner can manage employees.
      </div>
    );
  }
  const staff = zdb
    .get()
    .users.filter((u) => u.orgId === org.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-wider">
            Employees
          </h1>
          <p className="text-sm text-muted-foreground">{staff.length} accounts</p>
        </div>
        <GoldButton onClick={() => setShow(true)}>
          <UserPlus className="h-4 w-4" /> Add Cashier
        </GoldButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {staff.map((s) => (
          <div key={s.id} className="panel clip-cut-card p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-gold-gradient font-display text-lg font-black text-black">
                {s.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display font-bold text-gold">
                  {s.name}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {s.email}
                </div>
                <div className="mt-1 inline-block rounded bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest">
                  {s.role}
                </div>
              </div>
            </div>
            {s.role === "cashier" && (
              <div className="mt-3 border-t border-white/5 pt-3">
                <button
                  onClick={() => {
                    zdb.update((d) => {
                      const u = d.users.find((x) => x.id === s.id);
                      if (u) u.disabled = !u.disabled;
                    });
                  }}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-md border py-1.5 text-[11px] font-bold uppercase tracking-widest ${
                    s.disabled
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                      : "border-red-400/30 bg-red-400/10 text-red-300"
                  }`}
                >
                  {s.disabled ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Enable
                    </>
                  ) : (
                    <>
                      <Ban className="h-3.5 w-3.5" /> Disable
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {show && <CashierForm onClose={() => setShow(false)} />}
    </div>
  );
}

function CashierForm({ onClose }: { onClose: () => void }) {
  const { org } = useAuth();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  if (!org) return null;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const { email, phone } = resolveIdentifiers(
      mode === "email" ? f.email : "",
      mode === "phone" ? f.phone : "",
    );
    if (!email) {
      toast.error(mode === "phone" ? "Phone number is required" : "Email is required");
      return;
    }
    let dup = false;
    zdb.update((d) => {
      if (d.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        dup = true;
        return;
      }
      d.users.push({
        id: uid("u"),
        name: f.name,
        email,
        phone: phone || undefined,
        password: f.password,
        role: "cashier",
        orgId: org.id,
      });
    });
    if (dup) {
      toast.error("A user with that identifier already exists.");
      return;
    }
    toast.success("Cashier added");
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <form onSubmit={save} className="panel clip-cut-card w-full max-w-md space-y-4 p-6">
        <h3 className="font-display text-xl font-black uppercase tracking-widest text-gold">
          Add Cashier
        </h3>

        <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/60 p-1">
          {(["email", "phone"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition ${
                mode === m
                  ? "bg-gold-gradient text-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Name
          </span>
          <input
            required
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
        </label>

        {mode === "email" ? (
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Email
            </span>
            <input
              required
              type="email"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
            />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Phone number
            </span>
            <input
              required
              type="tel"
              inputMode="tel"
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
              placeholder="0712 345 678"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
            />
            <span className="mt-1 block text-[10px] text-muted-foreground">
              Phone-only accounts sign in with just the number.
            </span>
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Password
          </span>
          <input
            required
            type="text"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
        </label>

        <div className="flex gap-2 pt-2">
          <GoldButton type="submit" className="flex-1">Create</GoldButton>
          <GoldButton type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </GoldButton>
        </div>
      </form>
    </div>
  );
}
