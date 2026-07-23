import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, RefreshCcw, AlertTriangle, History } from "lucide-react";
import { zdb, uid } from "@/lib/zpos-db";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory")({
  component: Inventory,
});

function Inventory() {
  const { org, user } = useAuth();
  const [, setV] = useState(0);
  useEffect(() => {
    const u = zdb.subscribe(() => setV((n) => n + 1));
    return () => { u(); };
  }, []);
  const [mode, setMode] = useState<"in" | "out" | "adj">("in");
  const [pid, setPid] = useState("");
  const [amt, setAmt] = useState(0);
  const [note, setNote] = useState("");

  if (!org || !user) return null;
  const db = zdb.get();
  const products = db.products.filter((p) => p.orgId === org.id);
  const low = products.filter((p) => p.stock <= p.minStock);
  const movements = db.stockMovements
    .filter((m) => m.orgId === org.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50);

  const apply = () => {
    if (!pid) {
      toast.error("Pick a product");
      return;
    }
    if (mode !== "adj" && amt <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    if (mode === "adj" && amt < 0) {
      toast.error("Adjusted quantity cannot be negative");
      return;
    }
    let productName = "";
    zdb.update((d) => {
      const p = d.products.find((x) => x.id === pid);
      if (!p) return;
      productName = p.name;
      const before = p.stock;
      let change = 0;
      if (mode === "in") { p.stock += amt; change = amt; }
      else if (mode === "out") { p.stock = Math.max(0, p.stock - amt); change = -Math.min(amt, before); }
      else { change = amt - before; p.stock = amt; }
      p.updatedAt = Date.now();
      d.stockMovements.push({
        id: uid("mv"),
        orgId: org.id,
        productId: p.id,
        productName: p.name,
        type: mode === "adj" ? "adjust" : mode,
        qty: change,
        before,
        after: p.stock,
        userId: user.id,
        note: note.trim() || undefined,
        createdAt: Date.now(),
      });
    });
    toast.success(`${mode === "in" ? "Stock in" : mode === "out" ? "Stock out" : "Adjustment"} logged for ${productName}`);
    setAmt(0);
    setNote("");
  };

  const modes = [
    { k: "in" as const, label: "Stock In", icon: ArrowUp },
    { k: "out" as const, label: "Stock Out", icon: ArrowDown },
    { k: "adj" as const, label: "Adjust", icon: RefreshCcw },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black uppercase tracking-wider">
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
              className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-xs font-bold uppercase tracking-widest ${
                mode === m.k
                  ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-gold"
                  : "border-white/10 text-muted-foreground hover:bg-white/5"
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
            className="rounded-md border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-[color:var(--gold)]/60"
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
            className="rounded-md border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
          <GoldButton onClick={apply}>Apply</GoldButton>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional) — e.g. Supplier delivery, damaged goods…"
          className="mt-3 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
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
          <ul className="divide-y divide-white/5">
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
                  <tr key={m.id} className="border-t border-white/5">
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
