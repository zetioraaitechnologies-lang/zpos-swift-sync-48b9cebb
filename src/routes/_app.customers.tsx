import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Pencil, Phone, MapPin } from "lucide-react";
import {
  fmtMoney,
  useLive,
  listCustomers,
  listSales,
  upsertCustomer,
  deleteCustomer,
  type Customer,
  type Sale,
} from "@/lib/zpos-data";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/customers")({
  component: Customers,
});

function Customers() {
  const { org } = useAuth();
  const { data: customers, refresh } = useLive<Customer[]>(
    org?.id,
    ["customers"],
    listCustomers,
    [],
  );
  const { data: sales } = useLive<Sale[]>(org?.id, ["sales"], listSales, []);
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Customer | null>(null);

  if (!org) return null;

  const del = async (id: string) => {
    if (!confirm("Delete customer?")) return;
    try {
      await deleteCustomer(id);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-wider">
            Customers
          </h1>
          <p className="text-sm text-muted-foreground">{customers.length} contacts</p>
        </div>
        <GoldButton onClick={() => { setEdit(null); setShow(true); }}>
          <Plus className="h-4 w-4" /> Add Customer
        </GoldButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {customers.map((c) => {
          const history = sales.filter((s) => s.customerId === c.id);
          const spent = history.reduce((a, s) => a + s.total, 0);
          return (
            <div key={c.id} className="panel clip-cut-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-lg font-bold text-gold">
                    {c.name}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {c.phone}
                  </div>
                  {c.address && (
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {c.address}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEdit(c); setShow(true); }}
                    className="grid h-7 w-7 place-items-center rounded hover:bg-white/5"
                  >
                    <Pencil className="h-3.5 w-3.5 text-gold" />
                  </button>
                  <button
                    onClick={() => del(c.id)}
                    className="grid h-7 w-7 place-items-center rounded hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-xs">
                <span className="text-muted-foreground">
                  {history.length} purchases
                </span>
                <span className="font-display font-bold text-gold">
                  {fmtMoney(spent, org.currency)}
                </span>
              </div>
            </div>
          );
        })}
        {customers.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No customers yet.
          </div>
        )}
      </div>

      {show && (
        <CustomerForm
          existing={edit}
          onClose={() => { setShow(false); void refresh(); }}
        />
      )}
    </div>
  );
}

function CustomerForm({
  existing,
  onClose,
}: {
  existing: Customer | null;
  onClose: () => void;
}) {
  const { org } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    phone: existing?.phone ?? "",
    address: existing?.address ?? "",
  });
  if (!org) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await upsertCustomer(org.id, form, existing?.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
      <form onSubmit={save} className="panel clip-cut-card w-full max-w-md space-y-4 p-6">
        <h3 className="font-display text-xl font-black uppercase tracking-widest text-gold">
          {existing ? "Edit" : "Add"} Customer
        </h3>
        {(["name", "phone", "address"] as const).map((k) => (
          <label key={k} className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {k}
            </span>
            <input
              required={k !== "address"}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
            />
          </label>
        ))}
        <div className="flex gap-2 pt-2">
          <GoldButton type="submit" className="flex-1" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </GoldButton>
          <GoldButton type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </GoldButton>
        </div>
      </form>
    </div>
  );
}
