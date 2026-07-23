import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Phone, MapPin } from "lucide-react";
import { zdb, uid, fmtMoney } from "@/lib/zpos-db";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";

export const Route = createFileRoute("/_app/customers")({
  component: Customers,
});

function Customers() {
  const { org } = useAuth();
  const [, setV] = useState(0);
  useEffect(() => {
    const u = zdb.subscribe(() => setV((n) => n + 1));
    return () => { u(); };
  }, []);
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);

  if (!org) return null;
  const db = zdb.get();
  const customers = db.customers.filter((c) => c.orgId === org.id);

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
          const history = db.sales.filter(
            (s) => s.orgId === org.id && s.customerId === c.id,
          );
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
                    onClick={() => { setEdit(c.id); setShow(true); }}
                    className="grid h-7 w-7 place-items-center rounded hover:bg-white/5"
                  >
                    <Pencil className="h-3.5 w-3.5 text-gold" />
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm("Delete customer?")) return;
                      zdb.update((d) => {
                        d.customers = d.customers.filter((x) => x.id !== c.id);
                      });
                    }}
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
          id={edit}
          onClose={() => setShow(false)}
        />
      )}
    </div>
  );
}

function CustomerForm({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { org } = useAuth();
  const existing = id ? zdb.get().customers.find((c) => c.id === id) : null;
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    phone: existing?.phone ?? "",
    address: existing?.address ?? "",
  });
  if (!org) return null;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    zdb.update((d) => {
      if (existing) {
        const c = d.customers.find((x) => x.id === existing.id);
        if (c) Object.assign(c, form);
      } else {
        d.customers.push({
          id: uid("c"),
          orgId: org.id,
          ...form,
          createdAt: Date.now(),
        });
      }
    });
    onClose();
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
          <GoldButton type="submit" className="flex-1">Save</GoldButton>
          <GoldButton type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </GoldButton>
        </div>
      </form>
    </div>
  );
}
