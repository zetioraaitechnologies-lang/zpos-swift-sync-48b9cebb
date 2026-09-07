import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { inviteCashier, removeCashier } from "@/lib/admin.functions";
import { toast } from "sonner";
import { STAFF_ROLES } from "@/lib/staff-roles";

export const Route = createFileRoute("/_app/employees")({
  component: Employees,
});

interface EmployeeRow {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role_label: string | null;
  wage: number | null;
}

function Employees() {
  const { org, user } = useAuth();
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);

  const load = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, user_id, name, email, phone, role_label, wage")
      .eq("org_id", org.id)
      .order("name");
    if (error) toast.error(error.message);
    setRows((data ?? []) as EmployeeRow[]);
    setLoading(false);
  }, [org]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!org || user?.role !== "owner") {
    return (
      <div className="panel clip-cut-card p-8 text-center text-muted-foreground">
        Only the Owner can manage employees.
      </div>
    );
  }

  const remove = async (row: EmployeeRow) => {
    if (!row.user_id) {
      toast.error("This employee has no login account attached.");
      return;
    }
    if (!confirm(`Remove ${row.name}'s access to this business?`)) return;
    try {
      await removeCashier({ data: { orgId: org.id, userId: row.user_id } });
      toast.success("Cashier removed");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Employees
          </h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${rows.length} accounts`}
          </p>
        </div>
        <GoldButton onClick={() => setShow(true)}>
          <UserPlus className="h-4 w-4" /> Add Staff
        </GoldButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s) => (
          <div key={s.id} className="panel clip-cut-card p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-gold-gradient font-display text-lg font-bold text-on-accent">
                {s.name?.[0] ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display font-bold text-gold">
                  {s.name}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {s.email ?? s.phone ?? "—"}
                </div>
                <div className="mt-1 inline-block rounded-none bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-widest">
                  {s.role_label ?? "Cashier"}
                </div>
              </div>
            </div>
            {s.user_id && (
              <div className="mt-3 border-t border-border pt-3">
                <button
                  onClick={() => remove(s)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-none border border-red-400/30 bg-red-400/10 py-1.5 text-[11px] font-bold uppercase tracking-widest text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove access
                </button>
              </div>
            )}
          </div>
        ))}
        {!loading && rows.length === 0 && (
          <div className="col-span-full panel clip-cut-card p-8 text-center text-muted-foreground">
            No staff yet. Click <span className="text-gold">Add Staff</span> to issue their login.
          </div>
        )}
      </div>

      {show && (
        <CashierForm
          onClose={() => setShow(false)}
          onDone={() => {
            setShow(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function CashierForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { org } = useAuth();
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", wage: "", roleLabel: "Cashier" });
  const [busy, setBusy] = useState(false);
  if (!org) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const pw = f.password.trim() || "Cash" + Math.random().toString(36).slice(2, 10);
      await inviteCashier({
        data: {
          orgId: org.id,
          name: f.name,
          email: f.email.trim(),
          password: pw,
          phone: f.phone || undefined,
          roleLabel: f.roleLabel,
          wage: f.wage ? Number(f.wage) : undefined,
        },
      });
      toast.success(`${f.roleLabel} created · ${f.email.trim()} / ${pw}`, { duration: 20000 });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add staff");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/50 p-4">
      <form onSubmit={save} className="panel clip-cut-card w-full max-w-md space-y-4 p-6">
        <h3 className="font-display text-xl font-bold tracking-tight text-gold">
          Add Staff
        </h3>
        <p className="text-xs text-muted-foreground">
          Creates a login account for this business. Copy the credentials
          before closing the confirmation toast.
        </p>

        <FormRow label="Name">
          <input
            required
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
        </FormRow>
        <FormRow label="Email">
          <input
            required
            type="email"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
            className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
        </FormRow>
        <FormRow label="Job role">
          <select
            value={f.roleLabel}
            onChange={(e) => setF({ ...f, roleLabel: e.target.value })}
            className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Phone (optional)">
          <input
            type="tel"
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
            className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
        </FormRow>
        <FormRow label="Wage (optional)">
          <input
            type="number"
            value={f.wage}
            onChange={(e) => setF({ ...f, wage: e.target.value })}
            className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
        </FormRow>
        <FormRow label="Password (leave blank to auto-generate)">
          <input
            type="text"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
        </FormRow>

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

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
