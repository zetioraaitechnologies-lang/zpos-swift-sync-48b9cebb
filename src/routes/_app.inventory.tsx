import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  RefreshCcw,
  AlertTriangle,
  History,
  Search,
  Download,
  Layers,
  PackageX,
  Coins,
  Boxes,
} from "lucide-react";
import {
  useLive,
  listProducts,
  listStockMovements,
  fmtMoney,
  type Product,
  type StockMovement,
} from "@/lib/zpos-data";
import { listVariants, variantLabel, type ProductVariant } from "@/lib/zpos-trade";
import { fmtQty } from "@/lib/weighing";
import { safeAdjustStock } from "@/lib/zpos-offline";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory")({
  component: Inventory,
});

type Filter = "all" | "low" | "out" | "healthy";

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
    (id) => listStockMovements(id, 200),
    [],
  );
  const { data: variants } = useLive<ProductVariant[]>(
    org?.id,
    ["product_variants"],
    listVariants,
    [],
  );

  const [mode, setMode] = useState<"in" | "out" | "adj">("in");
  const [pid, setPid] = useState("");
  const [amt, setAmt] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mvProduct, setMvProduct] = useState("");

  const currency = org?.currency ?? "TZS";

  const variantsByProduct = useMemo(() => {
    const m = new Map<string, ProductVariant[]>();
    for (const v of variants) {
      const arr = m.get(v.productId) ?? [];
      arr.push(v);
      m.set(v.productId, arr);
    }
    return m;
  }, [variants]);

  const stats = useMemo(() => {
    let cost = 0;
    let retail = 0;
    let low = 0;
    let out = 0;
    for (const p of products) {
      cost += p.stock * (p.costPrice || 0);
      retail += p.stock * (p.price || 0);
      if (p.stock <= 0) out += 1;
      else if (p.stock <= p.minStock) low += 1;
    }
    return { cost, retail, low, out, skus: products.length };
  }, [products]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products
      .filter((p) => {
        if (term) {
          const hay = `${p.name} ${p.category ?? ""} ${p.barcode ?? ""}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        if (filter === "out") return p.stock <= 0;
        if (filter === "low") return p.stock > 0 && p.stock <= p.minStock;
        if (filter === "healthy") return p.stock > p.minStock;
        return true;
      })
      .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  }, [products, q, filter]);

  const shownMovements = useMemo(
    () => (mvProduct ? movements.filter((m) => m.productId === mvProduct) : movements).slice(0, 60),
    [movements, mvProduct],
  );

  if (!org || !user) return null;

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
      toast.success("Stock change queued");
      setAmt(0);
      setNote("");
      await Promise.all([refreshProducts(), refreshMv()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const header = ["Product", "Category", "Barcode", "Unit", "Stock", "Min", "Cost", "Price", "Stock value"];
    const lines = rows.map((p) => [
      p.name,
      p.category ?? "",
      p.barcode ?? "",
      p.unit ?? "",
      p.stock,
      p.minStock,
      p.costPrice,
      p.price,
      (p.stock * (p.costPrice || 0)).toFixed(2),
    ]);
    const csv = [header, ...lines]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${org.businessName.replace(/\s+/g, "-").toLowerCase()}-stock.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modes = [
    { k: "in" as const, label: "Stock In", icon: ArrowUp },
    { k: "out" as const, label: "Stock Out", icon: ArrowDown },
    { k: "adj" as const, label: "Adjust", icon: RefreshCcw },
  ];

  const filters: { k: Filter; label: string; count: number }[] = [
    { k: "all", label: "All", count: stats.skus },
    { k: "low", label: "Low", count: stats.low },
    { k: "out", label: "Out", count: stats.out },
    { k: "healthy", label: "Healthy", count: stats.skus - stats.low - stats.out },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {org.businessName} — stock levels, valuation and a full audit trail
          </p>
        </div>
        <GoldButton variant="outline" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </GoldButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox icon={Boxes} label="SKUs" value={String(stats.skus)} />
        <StatBox icon={Coins} label="Stock value (cost)" value={fmtMoney(stats.cost, currency)} />
        <StatBox icon={Coins} label="Retail value" value={fmtMoney(stats.retail, currency)} />
        <StatBox
          icon={PackageX}
          label="Low / Out"
          value={`${stats.low} / ${stats.out}`}
          alert={stats.low + stats.out > 0}
        />
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
                {p.name} (stock {fmtQty(p.stock, p.unit)})
              </option>
            ))}
          </select>
          <input
            type="number"
            inputMode="decimal"
            step="any"
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search product, category or barcode…"
              className="w-full rounded-none border border-border bg-input py-2 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--gold)]/60"
            />
          </div>
          {filters.map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={`rounded-none border px-3 py-2 text-[11px] font-bold uppercase tracking-widest ${
                filter === f.k
                  ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-gold"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No products match.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left uppercase tracking-widest text-muted-foreground">
                  <th className="p-2">Product</th>
                  <th className="p-2">Category</th>
                  <th className="p-2 text-right">Stock</th>
                  <th className="p-2 text-right">Min</th>
                  <th className="p-2 text-right">Value</th>
                  <th className="p-2 text-right">Status</th>
                  <th className="p-2 text-right">Quick</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const vs = variantsByProduct.get(p.id) ?? [];
                  const status =
                    p.stock <= 0 ? "out" : p.stock <= p.minStock ? "low" : "ok";
                  return (
                    <Fragment key={p.id}>
                      <tr className="border-t border-border">
                        <td className="p-2 font-semibold">
                          <button
                            onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                            className="inline-flex items-center gap-1.5 text-left"
                            disabled={vs.length === 0}
                          >
                            {vs.length > 0 && <Layers className="h-3.5 w-3.5 text-gold" />}
                            {p.name}
                            {vs.length > 0 && (
                              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                {vs.length} options
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="p-2 text-muted-foreground">{p.category || "—"}</td>
                        <td className="p-2 text-right font-bold">{fmtQty(p.stock, p.unit)}</td>
                        <td className="p-2 text-right text-muted-foreground">{p.minStock}</td>
                        <td className="p-2 text-right text-muted-foreground">
                          {fmtMoney(p.stock * (p.costPrice || 0), currency)}
                        </td>
                        <td className="p-2 text-right">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                              status === "out"
                                ? "bg-red-500/15 text-red-300"
                                : status === "low"
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-emerald-500/15 text-emerald-300"
                            }`}
                          >
                            {status === "ok" ? "healthy" : status}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <button
                            onClick={() => {
                              setPid(p.id);
                              setMode("in");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="border border-border px-2 py-1 text-[10px] uppercase tracking-widest hover:bg-secondary"
                          >
                            Restock
                          </button>
                        </td>
                      </tr>
                      {expanded === p.id &&
                        vs.map((v) => (
                          <tr key={v.id} className="border-t border-border/50 bg-secondary/30">
                            <td className="p-2 pl-8 text-muted-foreground">
                              {variantLabel(v) || "Variant"}
                            </td>
                            <td className="p-2 text-muted-foreground">{v.barcode || "—"}</td>
                            <td className="p-2 text-right font-semibold">
                              {fmtQty(v.stock, p.unit)}
                            </td>
                            <td className="p-2" />
                            <td className="p-2 text-right text-muted-foreground">
                              {fmtMoney(v.stock * (v.costPrice ?? p.costPrice ?? 0), currency)}
                            </td>
                            <td className="p-2 text-right text-[10px] uppercase tracking-widest text-muted-foreground">
                              {v.stock <= 0 ? "out" : "in stock"}
                            </td>
                            <td className="p-2" />
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel clip-cut-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-300" />
          <h3 className="font-display font-bold uppercase tracking-widest text-gold">
            Reorder list ({stats.low + stats.out})
          </h3>
        </div>
        {stats.low + stats.out === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">All stock healthy.</div>
        ) : (
          <ul className="divide-y divide-border">
            {products
              .filter((p) => p.stock <= p.minStock)
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      Min {p.minStock}
                      {p.unit ? ` ${p.unit}` : ""} · suggest order{" "}
                      {Math.max(p.minStock * 2 - p.stock, 1)}
                    </div>
                  </div>
                  <div
                    className={`font-display font-bold ${p.stock <= 0 ? "text-red-300" : "text-amber-300"}`}
                  >
                    {fmtQty(p.stock, p.unit)}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="panel clip-cut-card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <History className="h-4 w-4 text-gold" />
          <h3 className="flex-1 font-display font-bold uppercase tracking-widest text-gold">
            Stock movements
          </h3>
          <select
            value={mvProduct}
            onChange={(e) => setMvProduct(e.target.value)}
            className="rounded-none border border-border bg-input px-2 py-1.5 text-xs outline-none focus:border-[color:var(--gold)]/60"
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {shownMovements.length === 0 ? (
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
                {shownMovements.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="p-2 text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                    <td className="p-2 font-semibold">{m.productName}</td>
                    <td className="p-2 uppercase">{m.type}</td>
                    <td
                      className={`p-2 text-right font-bold ${m.qty >= 0 ? "text-emerald-300" : "text-red-300"}`}
                    >
                      {m.qty >= 0 ? `+${m.qty}` : m.qty}
                    </td>
                    <td className="p-2 text-right text-muted-foreground">
                      {m.before} → {m.after}
                    </td>
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

function StatBox({
  icon: Icon,
  label,
  value,
  alert,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="panel clip-cut-card flex items-center gap-3 p-4">
      <Icon className={`h-5 w-5 ${alert ? "text-amber-300" : "text-gold"}`} />
      <div className="min-w-0">
        <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <div className="truncate font-display text-lg font-bold">{value}</div>
      </div>
    </div>
  );
}
