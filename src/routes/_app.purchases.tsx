import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Truck, X } from "lucide-react";
import { fmtMoney, useLive, listProducts, type Product } from "@/lib/zpos-data";
import {
  listSuppliers,
  upsertSupplier,
  deleteSupplier,
  listPurchases,
  recordPurchase,
  type Supplier,
  type Purchase,
} from "@/lib/zpos-trade";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { fmtQty } from "@/lib/weighing";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/purchases")({
  component: Purchases,
});

interface Line { productId: string; qty: string; cost: string }

function Purchases() {
  const { org, user } = useAuth();
  const { data: suppliers, refresh: refreshSuppliers } = useLive<Supplier[]>(
    org?.id, ["suppliers"], listSuppliers, [],
  );
  const { data: purchases, refresh: refreshPurchases } = useLive<Purchase[]>(
    org?.id, ["purchases"], listPurchases, [],
  );
  const { data: products } = useLive<Product[]>(org?.id, ["products"], listProducts, []);
  const [showSupplier, setShowSupplier] = useState<Supplier | null | "new">(null);
  const [showPurchase, setShowPurchase] = useState(false);

  if (!org) return null;
  const isOwner = user?.role === "owner";

  const removeSupplier = async (id: string) => {
    if (!confirm("Delete this supplier?")) return;
    try {
      await deleteSupplier(id);
      toast.success("Supplier deleted");
      await refreshSuppliers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Purchases</h1>
          <p className="text-sm text-muted-foreground">
            Suppliers and goods received · stock rises automatically
          </p>
        </div>
        <div className="flex gap-2">
          <GoldButton variant="outline" onClick={() => setShowSupplier("new")}>
            <Truck className="h-4 w-4" /> Add supplier
          </GoldButton>
          <GoldButton onClick={() => setShowPurchase(true)}>
            <Plus className="h-4 w-4" /> Record purchase
          </GoldButton>
        </div>
      </div>

      <div className="panel clip-cut-card p-4">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gold">
          Suppliers · {suppliers.length}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-2 border border-border bg-secondary p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{s.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {[s.phone, s.email, s.address].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              {isOwner && (
                <div className="flex gap-1">
                  <button onClick={() => setShowSupplier(s)} className="text-[10px] uppercase tracking-widest text-gold">
                    Edit
                  </button>
                  <button onClick={() => removeSupplier(s.id)} className="text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {suppliers.length === 0 && (
            <div className="col-span-full py-6 text-center text-sm text-muted-foreground">
              No suppliers yet.
            </div>
          )}
        </div>
      </div>

      <div className="panel clip-cut-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="p-3">Date</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Items</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 font-semibold">{p.supplierName || "—"}</td>
                  <td className="p-3 text-muted-foreground">
                    {p.items.map((i) => `${i.name} ×${i.qty}`).join(", ") || "—"}
                  </td>
                  <td className="p-3 text-right font-bold text-gold">
                    {fmtMoney(p.total, org.currency)}
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No purchases recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSupplier && (
        <SupplierForm
          supplier={showSupplier === "new" ? null : showSupplier}
          onClose={() => { setShowSupplier(null); void refreshSuppliers(); }}
        />
      )}
      {showPurchase && (
        <PurchaseForm
          suppliers={suppliers}
          products={products}
          onClose={() => { setShowPurchase(false); void refreshPurchases(); }}
        />
      )}
    </div>
  );
}

function SupplierForm({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const { org } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    address: supplier?.address ?? "",
    note: supplier?.note ?? "",
  });
  if (!org) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await upsertSupplier(org.id, { ...form, name: form.name.trim() }, supplier?.id);
      toast.success("Supplier saved");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={supplier ? "Edit supplier" : "Add supplier"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        {([
          ["name", "Name *"],
          ["phone", "Phone"],
          ["email", "Email"],
          ["address", "Address"],
          ["note", "Note"],
        ] as const).map(([k, label]) => (
          <label key={k} className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {label}
            </span>
            <input
              required={k === "name"}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              className="w-full rounded-none border border-border bg-input px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
            />
          </label>
        ))}
        <GoldButton type="submit" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Save supplier"}
        </GoldButton>
      </form>
    </Modal>
  );
}

function PurchaseForm({
  suppliers,
  products,
  onClose,
}: {
  suppliers: Supplier[];
  products: Product[];
  onClose: () => void;
}) {
  const { org } = useAuth();
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", qty: "1", cost: "" }]);
  const [busy, setBusy] = useState(false);

  const total = useMemo(
    () => lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.cost) || 0), 0),
    [lines],
  );
  if (!org) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = lines
      .filter((l) => l.productId && Number(l.qty) > 0)
      .map((l) => {
        const p = products.find((x) => x.id === l.productId)!;
        return {
          productId: p.id,
          name: p.name,
          qty: Number(l.qty),
          cost: Number(l.cost) || p.costPrice,
        };
      });
    if (!items.length) return toast.error("Add at least one item");
    setBusy(true);
    try {
      await recordPurchase(org.id, {
        items,
        supplierId: supplierId || undefined,
        supplierName: suppliers.find((s) => s.id === supplierId)?.name,
        note: note.trim() || undefined,
      });
      toast.success("Purchase recorded · stock updated");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Record purchase" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="w-full rounded-none border border-border bg-input px-3 py-2 text-sm"
        >
          <option value="">Supplier (optional)</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_90px_28px] gap-1">
              <select
                value={l.productId}
                onChange={(e) => {
                  const p = products.find((x) => x.id === e.target.value);
                  setLines(lines.map((x, j) => (j === i ? { ...x, productId: e.target.value, cost: x.cost || String(p?.costPrice ?? "") } : x)));
                }}
                className="rounded-none border border-border bg-input px-2 py-2 text-sm"
              >
                <option value="">Select item…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({fmtQty(p.stock, p.unit)})
                  </option>
                ))}
              </select>
              <input
                type="number" step="any" min={0} value={l.qty} placeholder="Qty"
                onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                className="rounded-none border border-border bg-input px-2 py-2 text-right text-sm"
              />
              <input
                type="number" step="any" min={0} value={l.cost} placeholder="Cost"
                onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, cost: e.target.value } : x)))}
                className="rounded-none border border-border bg-input px-2 py-2 text-right text-sm"
              />
              <button
                type="button"
                onClick={() => setLines(lines.filter((_, j) => j !== i))}
                className="grid place-items-center text-red-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines([...lines, { productId: "", qty: "1", cost: "" }])}
            className="text-[11px] font-semibold uppercase tracking-widest text-gold"
          >
            + Add line
          </button>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note / invoice number (optional)"
          className="w-full rounded-none border border-border bg-input px-3 py-2 text-sm"
        />

        <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">Total cost</span>
          <span className="font-display text-lg font-bold text-gold">
            {fmtMoney(total, org.currency)}
          </span>
        </div>

        <GoldButton type="submit" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Save & add to stock"}
        </GoldButton>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/60 p-4">
      <div className="panel clip-cut-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold uppercase tracking-widest text-gold">
            {title}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
