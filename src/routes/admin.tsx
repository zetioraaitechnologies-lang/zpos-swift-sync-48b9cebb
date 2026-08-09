import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Building2,
  LogOut,
  Pause,
  Play,
  Trash2,
  KeyRound,
  Search,
  Pencil,
  Users,
  Package,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { ConnectivityBadge } from "@/components/zpos/connectivity";
import { StatCard } from "@/components/zpos/stat-card";
import {
  createOrgWithOwner,
  addStoreForOwner,

  deleteOrg,
  getPlatformStats,
  resetOwnerPassword,
  setOrgStatus,
  updateOrg,
} from "@/lib/admin.functions";
import { toast } from "sonner";
import { BUSINESS_MODES, getMode } from "@/lib/business-modes";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin — ZPOS Control Center" },
      {
        name: "description",
        content:
          "ZPOS super-admin control center: provision organizations, owners and monitor platform activity.",
      },
      { property: "og:title", content: "Super Admin — ZPOS Control Center" },
      {
        property: "og:description",
        content: "Provision organizations and monitor platform activity in ZPOS.",
      },
    ],
  }),
  component: Admin,
});

interface OrgRow {
  id: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  business_type: string | null;
  currency: string | null;
  status: string;
  created_at: string;
}

type OrgStats = {
  products: number;
  employees: number;
  sales: number;
  customers: number;
  revenue: number;
  lastSale: string | null;
};

function Admin() {
  const { user, ready, logout } = useAuth();
  const nav = useNavigate();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [stats, setStats] = useState<Record<string, OrgStats>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<OrgRow | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select(
        "id, business_name, email, phone, address, category, business_type, currency, status, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setOrgs((data ?? []) as OrgRow[]);
    try {
      const res = await getPlatformStats();
      setStats(res.per as Record<string, OrgStats>);
    } catch {
      /* metrics are best-effort */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) nav({ to: "/login" });
    else if (user.role !== "super_admin") nav({ to: "/dashboard" });
    else void load();
  }, [ready, user, nav, load]);

  const totals = useMemo(() => {
    const list = Object.values(stats);
    return {
      orgs: orgs.length,
      active: orgs.filter((o) => o.status === "active").length,
      users: list.reduce((s, x) => s + x.employees, 0),
      sales: list.reduce((s, x) => s + x.sales, 0),
      revenue: list.reduce((s, x) => s + x.revenue, 0),
    };
  }, [orgs, stats]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orgs.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (!needle) return true;
      return [o.business_name, o.email, o.phone, o.category]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [orgs, q, filter]);

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
    if (!confirm(`Delete "${o.business_name}" and ALL its data? This cannot be undone.`))
      return;
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
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-lg sm:px-5">
        <div className="grid h-9 w-9 place-items-center bg-gold-gradient clip-cut-sm">
          <span className="font-display text-base font-bold text-on-accent">Z</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base font-bold tracking-widest text-gold">
            ZPOS · Super Admin
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Zetiora AI Technologies
          </div>
        </div>
        <ConnectivityBadge />
        <button
          onClick={() => void load()}
          title="Refresh"
          className="inline-flex items-center gap-1.5 border border-border px-2.5 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:bg-secondary hover:text-gold"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-xs font-semibold uppercase tracking-widest text-destructive hover:bg-destructive/20"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Organizations" value={String(totals.orgs)} icon={Building2} accent />
          <StatCard
            label="Active"
            value={String(totals.active)}
            hint={`${totals.orgs - totals.active} suspended`}
            icon={Play}
          />
          <StatCard label="Staff accounts" value={String(totals.users)} icon={Users} />
          <StatCard
            label="Platform sales"
            value={String(totals.sales)}
            hint={`${Math.round(totals.revenue).toLocaleString()} total value`}
            icon={Receipt}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search organizations…"
              className="w-full border border-border bg-input py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--gold)]"
            />
          </div>
          <div className="flex gap-1.5">
            {(["all", "active", "suspended"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`border px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${
                  filter === f
                    ? "border-[color:var(--gold)] bg-[color:var(--gold)]/12 text-gold"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <GoldButton onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New org
          </GoldButton>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((o) => {
            const s = stats[o.id];
            return (
              <div key={o.id} className="panel clip-cut-card p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center bg-gold-gradient clip-cut-sm">
                    <Building2 className="h-5 w-5 text-on-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-base font-bold text-gold">
                      {o.business_name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {o.email ?? "—"}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {[getMode(o.business_type).label, o.phone, o.category]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                      o.status === "active"
                        ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-1.5 border-y border-border py-2 text-center">
                  <Metric icon={Package} label="Items" value={s?.products ?? 0} />
                  <Metric icon={Users} label="Staff" value={s?.employees ?? 0} />
                  <Metric icon={Receipt} label="Sales" value={s?.sales ?? 0} />
                  <Metric
                    icon={Building2}
                    label="Clients"
                    value={s?.customers ?? 0}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>Rev {Math.round(s?.revenue ?? 0).toLocaleString()}</span>
                  <span>
                    {s?.lastSale
                      ? `Last sale ${new Date(s.lastSale).toLocaleDateString()}`
                      : "No sales yet"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  <IconBtn
                    onClick={() => toggle(o)}
                    label={o.status === "active" ? "Suspend" : "Activate"}
                  >
                    {o.status === "active" ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </IconBtn>
                  <IconBtn onClick={() => setEditing(o)} label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn onClick={() => resetPw(o)} label="Reset PW">
                    <KeyRound className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn onClick={() => del(o)} label="Delete" danger>
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconBtn>
                </div>
              </div>
            );
          })}
          {!loading && visible.length === 0 && (
            <div className="panel col-span-full clip-cut-card p-8 text-center text-muted-foreground">
              {orgs.length === 0 ? (
                <>
                  No organizations yet. Click{" "}
                  <span className="text-gold">New org</span> to add the first owner.
                </>
              ) : (
                "No organizations match this search."
              )}
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
      {editing && (
        <EditOrgForm
          org={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div>
      <Icon className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
      <div className="font-display text-sm font-bold">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
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
      className={`flex flex-col items-center gap-1 border py-2 text-[9px] font-bold uppercase tracking-widest ${
        danger
          ? "border-destructive/40 text-destructive hover:bg-destructive/10"
          : "border-border text-muted-foreground hover:bg-secondary hover:text-gold"
      }`}
    >
      {children}
      {label}
    </button>
  );
}

function CreateOrgForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [f, setF] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    category: "Retail",
    businessType: "general",
    currency: "TZS",
  });
  const [existingOwner, setExistingOwner] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (existingOwner) {
        await addStoreForOwner({
          data: {
            ownerEmail: f.email.trim(),
            businessName: f.businessName,
            phone: f.phone || undefined,
            address: f.address || undefined,
            category: f.category,
            businessType: f.businessType,
            currency: f.currency,
          },
        });
        toast.success(`Store added to ${f.email.trim()} — they can switch stores after re-login.`, {
          duration: 15000,
        });
        onCreated();
        return;
      }
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
          businessType: f.businessType,
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
    <Modal onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <h3 className="font-display text-lg font-bold tracking-tight text-gold">
          {existingOwner ? "Add store to existing owner" : "Create organization"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {existingOwner
            ? "The owner keeps their current login and switches between stores inside the app."
            : "Issues login credentials for the owner. Copy them before closing the toast."}
        </p>

        <label className="flex items-center gap-2 border border-border bg-secondary/40 px-3 py-2 text-xs">
          <input
            type="checkbox"
            checked={existingOwner}
            onChange={(e) => setExistingOwner(e.target.checked)}
          />
          <span>This owner already has an account (multi-store / new branch)</span>
        </label>


        <div className="grid grid-cols-2 gap-2.5">
          <Field
            label="Business Name"
            colSpan
            value={f.businessName}
            onChange={(v) => setF({ ...f, businessName: v })}
          />
          {!existingOwner && (
            <Field
              label="Owner Name"
              value={f.ownerName}
              onChange={(v) => setF({ ...f, ownerName: v })}
            />
          )}

          <Field
            label="Business Category"
            value={f.category}
            onChange={(v) => setF({ ...f, category: v })}
          />
          <ModeField
            value={f.businessType}
            onChange={(v) => setF({ ...f, businessType: v })}
          />
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
          <Field
            label="Address"
            colSpan
            requiredField={false}
            value={f.address}
            onChange={(v) => setF({ ...f, address: v })}
          />
          <Field
            label="Owner Password (leave blank to auto-generate)"
            colSpan
            requiredField={false}
            value={f.password}
            onChange={(v) => setF({ ...f, password: v })}
            hint="Minimum 6 characters. The owner can change it later."
          />
        </div>
        <div className="flex gap-2 pt-1">
          <GoldButton type="submit" className="flex-1" disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </GoldButton>
          <GoldButton type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </GoldButton>
        </div>
      </form>
    </Modal>
  );
}

function EditOrgForm({
  org,
  onClose,
  onSaved,
}: {
  org: OrgRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    businessName: org.business_name,
    email: org.email ?? "",
    phone: org.phone ?? "",
    address: org.address ?? "",
    category: org.category ?? "",
    businessType: org.business_type ?? "general",
    currency: org.currency ?? "TZS",
  });
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateOrg({
        data: {
          orgId: org.id,
          businessName: f.businessName,
          email: f.email.trim() || null,
          phone: f.phone || null,
          address: f.address || null,
          category: f.category || null,
          businessType: f.businessType,
          currency: f.currency || "TZS",
        },
      });
      toast.success("Organization updated");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <h3 className="font-display text-lg font-bold tracking-tight text-gold">
          Edit organization
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <Field
            label="Business Name"
            colSpan
            value={f.businessName}
            onChange={(v) => setF({ ...f, businessName: v })}
          />
          <Field
            label="Contact Email"
            type="email"
            requiredField={false}
            value={f.email}
            onChange={(v) => setF({ ...f, email: v })}
            hint="Changing this does not change the owner's login email."
          />
          <Field
            label="Phone"
            requiredField={false}
            value={f.phone}
            onChange={(v) => setF({ ...f, phone: v })}
          />
          <Field
            label="Category"
            requiredField={false}
            value={f.category}
            onChange={(v) => setF({ ...f, category: v })}
          />
          <Field
            label="Currency"
            requiredField={false}
            value={f.currency}
            onChange={(v) => setF({ ...f, currency: v })}
          />
          <ModeField
            value={f.businessType}
            onChange={(v) => setF({ ...f, businessType: v })}
          />
          <Field
            label="Address"
            colSpan
            requiredField={false}
            value={f.address}
            onChange={(v) => setF({ ...f, address: v })}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <GoldButton type="submit" className="flex-1" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </GoldButton>
          <GoldButton type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </GoldButton>
        </div>
      </form>
    </Modal>
  );
}

function ModeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const mode = getMode(value);
  return (
    <label className="col-span-2 block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Business Mode
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border bg-input px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]"
      >
        {BUSINESS_MODES.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <span className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span
          className="inline-block h-2.5 w-2.5"
          style={{ background: mode.accent.base }}
        />
        {mode.tagline} · adds {mode.fields.length} extra field
        {mode.fields.length === 1 ? "" : "s"} to {mode.itemPlural.toLowerCase()}
      </span>
    </label>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/50 p-4"
      onClick={onClose}
    >
      <div
        className="panel clip-cut-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
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
        className="w-full border border-border bg-input px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]"
      />
      {hint && <span className="mt-1 block text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
