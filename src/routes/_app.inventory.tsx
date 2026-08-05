import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUp, ArrowDown, RefreshCcw, AlertTriangle, History } from "lucide-react";
import {
  useLive,
  listProducts,
  listStockMovements,
  type Product,
  type StockMovement,
} from "@/lib/zpos-data";
import { safeAdjustStock } from "@/lib/zpos-offline";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory")({
  component: Inventory,
});

function Inventory() {
  const { org, user } = useAuth();
  const { data: products, refresh: refreshProducts } = useLive<Product[]>(
    org?.id,
    ["products"],
    listProducts,
    [],
  );
  const { data: movements, refresh: refreshMv } = useLive<StockMovement[]>(
    org?.id,
    ["stock_movements"],
    (id) => listStockMovements(id, 50),
    [],
  );
  const [mode, setMode] = useState<"in" | "out" | "adj">("in");
  const [pid, setPid] = useState("");
  const [amt, setAmt] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!org || !user) return null;
  const low = products.filter((p) => p.stock <= p.minStock);

  const apply = async () => {
    if (!pid) return toast.error("Pick a product");
    if (mode !== "adj" && amt <= 0) return toast.error("Amount must be > 0");
    if (mode === "adj" && amt < 0) return toast.error("Quantity cannot be negative");
    setBusy(true);
    try {
      await safeAdjustStock(org.id, {
        productId: pid,
        mode,
        amount: amt,
        note: note.trim() || undefined,
        userId: user.id,
      });
      toast.success(mode === "in" ? "Stock change queued" : mode === "out" ? "Stock change queued" : "Adjustment queued");
      setAmt(0);
      setNote("");
      await Promise.all([refreshProducts(), refreshMv()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const modes = [
    { k: "in" as const, label: "Stock In", icon: ArrowUp },
    { k: "out" as const, label: "Stock Out", icon: ArrowDown },
    { k: "adj" as const, label: "Adjust", icon: RefreshCcw },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Inventory
        </h1>
        <p className="text-sm text-muted-foreground">Manage stock levels — every change is logged</p>
      </div>

      <div className="panel clip-cut-card p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {modes.map((m) => (
            <button
              key={m.k}
              onClick={() => setMode(m.k)}
              className={`inline-flex items-center gap-2 rounded-none border px-4 py-2 text-xs font-bold uppercase tracking-widest ${
                mode === m.k
                  ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-gold"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              <m.icon className="h-3.5 w-3.5" /> {m.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
          <select
            value={pid}
            onChange={(e) => setPid(e.target.value)}
            className="rounded-none border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-[color:var(--gold)]/60"
          >
            <option value="">Select product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (stock {p.stock}{p.unit ? ` ${p.unit}` : ""})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={amt}
            onChange={(e) => setAmt(+e.target.value)}
            placeholder={mode === "adj" ? "New qty" : "Amount"}
            className="rounded-none border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
          <GoldButton onClick={apply} disabled={busy}>{busy ? "Saving…" : "Apply"}</GoldButton>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional) — e.g. Supplier delivery, damaged goods…"
          className="mt-3 w-full rounded-none border border-border bg-input px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
        />
      </div>

      <div className="panel clip-cut-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-300" />
          <h3 className="font-display font-bold uppercase tracking-widest text-gold">
            Low Stock ({low.length})
          </h3>
        </div>
        {low.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            All stock healthy.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {low.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Min {p.minStock}{p.unit ? ` ${p.unit}` : ""}
                  </div>
                </div>
                <div className="font-display font-bold text-amber-300">
                  {p.stock}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel clip-cut-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-gold" />
          <h3 className="font-display font-bold uppercase tracking-widest text-gold">
            Recent Movements
          </h3>
        </div>
        {movements.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No stock movements yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left uppercase tracking-widest text-muted-foreground">
                  <th className="p-2">When</th>
                  <th className="p-2">Product</th>
                  <th className="p-2">Type</th>
                  <th className="p-2 text-right">Change</th>
                  <th className="p-2 text-right">Before → After</th>
                  <th className="p-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="p-2 text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</td>
                    <td className="p-2 font-semibold">{m.productName}</td>
                    <td className="p-2 uppercase">{m.type}</td>
                    <td className={`p-2 text-right font-bold ${m.qty >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {m.qty >= 0 ? `+${m.qty}` : m.qty}
                    </td>
                    <td className="p-2 text-right text-muted-foreground">{m.before} → {m.after}</td>
                    <td className="p-2 text-muted-foreground">{m.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
