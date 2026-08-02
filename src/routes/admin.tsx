import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Plus, Building2, LogOut, Pause, Play, Trash2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { ConnectivityBadge } from "@/components/zpos/connectivity";
import {
  createOrgWithOwner,
  deleteOrg,
  resetOwnerPassword,
  setOrgStatus,
} from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: Admin,
});

interface OrgRow {
  id: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  category: string | null;
  status: string;
  created_at: string;
}

function Admin() {
  const { user, ready, logout } = useAuth();
  const nav = useNavigate();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select("id, business_name, email, phone, category, status, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setOrgs((data ?? []) as OrgRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) nav({ to: "/login" });
    else if (user.role !== "super_admin") nav({ to: "/dashboard" });
    else void load();
  }, [ready, user, nav, load]);

  if (!user || user.role !== "super_admin") return null;

  const toggle = async (o: OrgRow) => {
    const status = o.status === "active" ? "suspended" : "active";
    try {
      await setOrgStatus({ data: { orgId: o.id, status } });
      toast.success(`Organization ${status}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const del = async (o: OrgRow) => {
    if (!confirm(`Delete "${o.business_name}" and ALL its data? This cannot be undone.`)) return;
    try {
      await deleteOrg({ data: { orgId: o.id } });
      toast.success("Organization deleted");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const resetPw = async (o: OrgRow) => {
    const newPw = "Zpos" + Math.random().toString(36).slice(2, 10);
    try {
      await resetOwnerPassword({ data: { orgId: o.id, newPassword: newPw } });
      toast.success(`New owner password: ${newPw}`, { duration: 15000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-[color:var(--gold)]/15 bg-card/95 px-6 py-4 backdrop-blur-lg">
        <div className="grid h-10 w-10 place-items-center bg-gold-gradient clip-cut-sm">
          <span className="font-display text-lg font-bold text-on-accent">Z</span>
        </div>
        <div className="flex-1">
          <div className="font-display text-lg font-bold tracking-widest text-gold">
            ZPOS · Super Admin
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Zetiora AI Technologies
          </div>
        </div>
        <ConnectivityBadge />
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-none border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-red-300 hover:bg-red-500/20"
        >
          <LogOut className="h-3.5 w-3.5" /> Logout
        </button>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Organizations
            </h1>
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading…" : `${orgs.length} tenants under management`}
            </p>
          </div>
          <GoldButton onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Create Organization
          </GoldButton>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orgs.map((o) => (
            <div key={o.id} className="panel clip-cut-card p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 place-items-center bg-gold-gradient clip-cut-sm">
                  <Building2 className="h-5 w-5 text-on-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-lg font-bold text-gold">
                    {o.business_name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {o.email ?? "—"}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {o.phone ?? ""} · {o.category ?? ""}
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
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                <IconBtn onClick={() => toggle(o)} label={o.status === "active" ? "Suspend" : "Activate"}>
                  {o.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </IconBtn>
                <IconBtn onClick={() => resetPw(o)} label="Reset PW">
                  <KeyRound className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn onClick={() => del(o)} label="Delete" danger>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            </div>
          ))}
          {!loading && orgs.length === 0 && (
            <div className="col-span-full panel clip-cut-card p-8 text-center text-muted-foreground">
              No organizations yet. Click <span className="text-gold">Create Organization</span> to add the first owner.
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <CreateOrgForm
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}
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
      className={`flex flex-col items-center gap-1 rounded-none border py-2 text-[9px] font-bold uppercase tracking-widest ${
        danger
          ? "border-red-500/30 text-red-300 hover:bg-red-500/10"
          : "border-border text-muted-foreground hover:bg-secondary hover:text-gold"
      }`}
    >
      {children}
      {label}
    </button>
  );
}

function CreateOrgForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    category: "Retail",
    currency: "TZS",
  });
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const pw = f.password.trim() || "Owner" + Math.random().toString(36).slice(2, 10);
      await createOrgWithOwner({
        data: {
          businessName: f.businessName,
          ownerName: f.ownerName,
          email: f.email.trim(),
          password: pw,
          phone: f.phone || undefined,
          address: f.address || undefined,
          category: f.category,
          currency: f.currency,
        },
      });
      toast.success(`Owner created · ${f.email.trim()} / ${pw}`, { duration: 20000 });
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/50 p-4">
      <form onSubmit={save} className="panel clip-cut-card w-full max-w-lg space-y-3 p-6">
        <h3 className="font-display text-xl font-bold tracking-tight text-gold">
          Create Organization
        </h3>
        <p className="text-xs text-muted-foreground">
          Issues login credentials for the owner. They will sign in with the email &
          password below. Copy them before closing the toast.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Business Name" colSpan value={f.businessName} onChange={(v) => setF({ ...f, businessName: v })} />
          <Field label="Owner Name" value={f.ownerName} onChange={(v) => setF({ ...f, ownerName: v })} />
          <Field label="Business Category" value={f.category} onChange={(v) => setF({ ...f, category: v })} />
          <Field label="Owner Email" type="email" required value={f.email} onChange={(v) => setF({ ...f, email: v })} />
          <Field label="Phone (optional)" type="tel" requiredField={false} value={f.phone} onChange={(v) => setF({ ...f, phone: v })} />
          <Field label="Address" colSpan requiredField={false} value={f.address} onChange={(v) => setF({ ...f, address: v })} />
          <Field
            label="Owner Password (leave blank to auto-generate)"
            colSpan
            requiredField={false}
            value={f.password}
            onChange={(v) => setF({ ...f, password: v })}
            hint="Minimum 6 characters. The owner can change it later."
          />
        </div>
        <div className="flex gap-2 pt-2">
          <GoldButton type="submit" className="flex-1" disabled={busy}>
            {busy ? "Creating…" : "Create"}
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
        className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
      />
      {hint && <span className="mt-1 block text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
