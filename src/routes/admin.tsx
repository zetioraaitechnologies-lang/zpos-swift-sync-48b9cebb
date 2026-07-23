import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Building2, LogOut, Pause, Play, Trash2, KeyRound } from "lucide-react";
import { zdb, uid, type Organization } from "@/lib/zpos-db";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { ConnectivityBadge } from "@/components/zpos/connectivity";
import { resolveIdentifiers } from "@/lib/zpos-identifiers";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: Admin,
});

function Admin() {
  const { user, ready, logout } = useAuth();
  const nav = useNavigate();
  const [, setV] = useState(0);
  useEffect(() => {
    const u = zdb.subscribe(() => setV((n) => n + 1));
    return () => { u(); };
  }, []);
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Organization | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) nav({ to: "/login" });
    else if (user.role !== "super_admin") nav({ to: "/dashboard" });
  }, [ready, user, nav]);

  if (!user || user.role !== "super_admin") return null;

  const db = zdb.get();

  const toggle = (id: string) =>
    zdb.update((d) => {
      const o = d.orgs.find((x) => x.id === id);
      if (o) o.status = o.status === "active" ? "suspended" : "active";
    });

  const del = (id: string) => {
    if (!confirm("Delete organization and all its users?")) return;
    zdb.update((d) => {
      d.orgs = d.orgs.filter((o) => o.id !== id);
      d.users = d.users.filter((u) => u.orgId !== id);
      d.products = d.products.filter((p) => p.orgId !== id);
      d.sales = d.sales.filter((s) => s.orgId !== id);
      d.expenses = d.expenses.filter((e) => e.orgId !== id);
      d.customers = d.customers.filter((c) => c.orgId !== id);
    });
    toast.success("Organization deleted");
  };

  const resetPw = (orgId: string) => {
    const newPw = "Zpos" + Math.random().toString(36).slice(2, 8);
    zdb.update((d) => {
      const owner = d.users.find((u) => u.orgId === orgId && u.role === "owner");
      if (owner) owner.password = newPw;
    });
    toast.success(`Owner password reset to: ${newPw}`, { duration: 12000 });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-[color:var(--gold)]/15 bg-card/95 px-6 py-4 backdrop-blur-lg">
        <div className="grid h-10 w-10 place-items-center bg-gold-gradient clip-cut-sm">
          <span className="font-display text-lg font-black text-black">Z</span>
        </div>
        <div className="flex-1">
          <div className="font-display text-lg font-black tracking-widest text-gold">
            ZPOS · Super Admin
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Zetiora AI Technologies
          </div>
        </div>
        <ConnectivityBadge />
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-red-300 hover:bg-red-500/20"
        >
          <LogOut className="h-3.5 w-3.5" /> Logout
        </button>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-black uppercase tracking-wider">
              Organizations
            </h1>
            <p className="text-sm text-muted-foreground">
              {db.orgs.length} tenants under management
            </p>
          </div>
          <GoldButton onClick={() => { setEdit(null); setShow(true); }}>
            <Plus className="h-4 w-4" /> Create Organization
          </GoldButton>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {db.orgs.map((o) => (
            <div key={o.id} className="panel clip-cut-card p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 place-items-center bg-gold-gradient clip-cut-sm">
                  <Building2 className="h-5 w-5 text-black" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-lg font-bold text-gold">
                    {o.businessName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {o.ownerName} · {o.email}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {o.phone} · {o.category}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                    o.status === "active"
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-red-400/15 text-red-300"
                  }`}
                >
                  {o.status}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-1.5">
                <IconBtn onClick={() => { setEdit(o); setShow(true); }} label="Edit">
                  <KeyRound className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn onClick={() => toggle(o.id)} label={o.status === "active" ? "Suspend" : "Activate"}>
                  {o.status === "active" ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </IconBtn>
                <IconBtn onClick={() => resetPw(o.id)} label="Reset PW">
                  <KeyRound className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn onClick={() => del(o.id)} label="Delete" danger>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            </div>
          ))}
        </div>
      </main>

      {show && <OrgForm org={edit} onClose={() => setShow(false)} />}
    </div>
  );
}

function IconBtn({
  onClick,
  label,
  children,
  danger,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-md border py-2 text-[9px] font-bold uppercase tracking-widest ${
        danger
          ? "border-red-500/30 text-red-300 hover:bg-red-500/10"
          : "border-white/10 text-muted-foreground hover:bg-white/5 hover:text-gold"
      }`}
    >
      {children}
      {label}
    </button>
  );
}

function OrgForm({ org, onClose }: { org: Organization | null; onClose: () => void }) {
  const [mode, setMode] = useState<"email" | "phone">(
    org && org.email && !org.email.endsWith("@local.zpos") ? "email" : (org?.phone ? "phone" : "email"),
  );
  const [f, setF] = useState({
    businessName: org?.businessName ?? "",
    ownerName: org?.ownerName ?? "",
    phone: org?.phone ?? "",
    email: org?.email && !org.email.endsWith("@local.zpos") ? org.email : "",
    address: org?.address ?? "",
    category: org?.category ?? "Retail",
    password: "",
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const { email, phone } = resolveIdentifiers(
      mode === "email" ? f.email : "",
      mode === "phone" ? f.phone : (mode === "email" ? f.phone : ""),
    );
    if (!email) {
      toast.error(mode === "phone" ? "Owner phone number is required" : "Owner email is required");
      return;
    }

    if (org) {
      zdb.update((d) => {
        const o = d.orgs.find((x) => x.id === org.id);
        if (o) Object.assign(o, {
          businessName: f.businessName,
          ownerName: f.ownerName,
          phone,
          email,
          address: f.address,
          category: f.category,
        });
        if (f.password.trim()) {
          const owner = d.users.find((u) => u.orgId === org.id && u.role === "owner");
          if (owner) owner.password = f.password.trim();
        }
      });
      toast.success("Organization updated");
      onClose();
      return;
    }
    const pw = f.password.trim() || ("Owner" + Math.random().toString(36).slice(2, 8));
    const orgId = uid("org");
    let dup = false;
    zdb.update((d) => {
      if (d.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        dup = true;
        return;
      }
      d.orgs.push({
        id: orgId,
        businessName: f.businessName,
        ownerName: f.ownerName,
        phone,
        email,
        address: f.address,
        category: f.category,
        status: "active",
        createdAt: Date.now(),
        currency: "TZS",
      });
      d.users.push({
        id: uid("u"),
        email,
        phone: phone || undefined,
        name: f.ownerName,
        password: pw,
        role: "owner",
        orgId,
      });
    });
    if (dup) {
      toast.error("A user with that email/phone already exists.");
      return;
    }
    const loginId = mode === "phone" ? phone : email;
    toast.success(`Organization created · ${loginId} / ${pw}`, { duration: 15000 });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <form onSubmit={save} className="panel clip-cut-card w-full max-w-lg space-y-3 p-6">
        <h3 className="font-display text-xl font-black uppercase tracking-widest text-gold">
          {org ? "Edit" : "Create"} Organization
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
              Owner signs in with {m}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Business Name"
            colSpan
            value={f.businessName}
            onChange={(v) => setF({ ...f, businessName: v })}
          />
          <Field
            label="Owner Name"
            value={f.ownerName}
            onChange={(v) => setF({ ...f, ownerName: v })}
          />
          <Field
            label="Business Category"
            value={f.category}
            onChange={(v) => setF({ ...f, category: v })}
          />

          {mode === "email" ? (
            <>
              <Field
                label="Owner Email"
                type="email"
                required
                value={f.email}
                onChange={(v) => setF({ ...f, email: v })}
              />
              <Field
                label="Phone (optional)"
                type="tel"
                requiredField={false}
                value={f.phone}
                onChange={(v) => setF({ ...f, phone: v })}
              />
            </>
          ) : (
            <>
              <Field
                label="Owner Phone"
                type="tel"
                required
                value={f.phone}
                onChange={(v) => setF({ ...f, phone: v })}
                hint="Signs in with this number"
              />
              <Field
                label="Email (optional)"
                type="email"
                requiredField={false}
                value={f.email}
                onChange={(v) => setF({ ...f, email: v })}
              />
            </>
          )}
          <Field
            label="Address"
            colSpan
            value={f.address}
            onChange={(v) => setF({ ...f, address: v })}
          />
          <Field
            label={org ? "New Owner Password (leave blank to keep)" : "Owner Password (optional — auto-generated if empty)"}
            colSpan
            requiredField={false}
            value={f.password}
            onChange={(v) => setF({ ...f, password: v })}
            hint="Set a custom password for the owner to sign in with."
          />
        </div>
        <div className="flex gap-2 pt-2">
          <GoldButton type="submit" className="flex-1">
            {org ? "Save" : "Create"}
          </GoldButton>
          <GoldButton type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </GoldButton>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  requiredField = true,
  colSpan,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  requiredField?: boolean;
  colSpan?: boolean;
  hint?: string;
}) {
  return (
    <label className={colSpan ? "col-span-2 block" : "block"}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        required={required ?? requiredField}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
      />
      {hint && <span className="mt-1 block text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
