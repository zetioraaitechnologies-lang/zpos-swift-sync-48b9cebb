import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Layers } from "lucide-react";
import {
  fmtMoney,
  useLive,
  listProducts,
  type Product,
} from "@/lib/zpos-data";
import { safeUpsertProduct, safeDeleteProduct } from "@/lib/zpos-offline";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { toast } from "sonner";
import { getMode, daysUntil, type ModeField } from "@/lib/business-modes";
import { UNIT_SUGGESTIONS, fmtQty } from "@/lib/weighing";

export const Route = createFileRoute("/_app/products")({
  component: Products,
});

function Products() {
  const { org, user } = useAuth();
  const { data: all, refresh } = useLive<Product[]>(
    org?.id,
    ["products"],
    listProducts,
    [],
  );
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  if (!org) return null;
  const mode = getMode(org.businessType);
  const extraCols = mode.fields.filter((f) => f.column);
  const products = all.filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()),
  );

  const canDelete = user?.role === "owner";

  const del = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await safeDeleteProduct(id);
      toast.success("Queued for deletion");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {mode.itemPlural}
          </h1>
          <p className="text-sm text-muted-foreground">
            {products.length} items · {mode.label}
          </p>
        </div>
        <GoldButton onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> Add {mode.itemSingular}
        </GoldButton>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${mode.itemPlural.toLowerCase()}…`}
          className="w-full rounded-none border border-border bg-input py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[color:var(--gold)]/60"
        />
      </div>

      {mode.expiryField && <ExpiryAlerts products={products} field={mode.expiryField} />}

      <div className="panel clip-cut-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="p-3">Name</th>
                <th className="p-3">Category</th>
                {extraCols.map((c) => (
                  <th key={c.key} className="p-3">
                    {c.label}
                  </th>
                ))}
                <th className="p-3 text-right">Cost</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3 text-right">Stock</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 hover:bg-secondary"
                >
                  <td className="p-3 font-semibold">{p.name}</td>
                  <td className="p-3 text-muted-foreground">{p.category}</td>
                  {extraCols.map((c) => (
                    <td key={c.key} className="p-3 text-muted-foreground">
                      <AttrCell product={p} field={c} expiryKey={mode.expiryField} />
                    </td>
                  ))}
                  <td className="p-3 text-right">{fmtMoney(p.costPrice, org.currency)}</td>
                  <td className="p-3 text-right font-bold text-gold">
                    {fmtMoney(p.price, org.currency)}
                  </td>
                  <td
                    className={`p-3 text-right font-bold ${
                      p.stock <= p.minStock ? "text-amber-300" : ""
                    }`}
                  >
                    {fmtQty(p.stock, p.unit)}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => { setEditing(p); setShowForm(true); }}
                        className="grid h-8 w-8 place-items-center rounded-none hover:bg-white/10"
                      >
                        <Pencil className="h-4 w-4 text-gold" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => del(p.id)}
                          className="grid h-8 w-8 place-items-center rounded-none hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6 + extraCols.length} className="p-8 text-center text-muted-foreground">
                    No {mode.itemPlural.toLowerCase()} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ProductForm
          product={editing}
          onClose={() => { setShowForm(false); void refresh(); }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { org } = useAuth();
  const [busy, setBusy] = useState(false);
  const mode = getMode(org?.businessType);
  const hasSoldBy = mode.fields.some((f) => f.key === "sold_by");
  const [attrs, setAttrs] = useState<Record<string, string>>(() => {
    const src = (product?.attributes ?? {}) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const f of getMode(org?.businessType).fields) out[f.key] = src[f.key] == null ? "" : String(src[f.key]);
    out["sold_by"] = src["sold_by"] == null ? "" : String(src["sold_by"]);
    return out;
  });
  const [form, setForm] = useState({
    name: product?.name ?? "",
    category: product?.category ?? "",
    barcode: product?.barcode ?? "",
    unit: product?.unit ?? "",
    description: product?.description ?? "",
    costPrice: product?.costPrice?.toString() ?? "",
    price: product?.price?.toString() ?? "",
    stock: product?.stock?.toString() ?? "",
    minStock: product?.minStock?.toString() ?? "",
  });
  if (!org) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await safeUpsertProduct(
        org.id,
        {
          name: form.name.trim(),
          category: form.category.trim() || "General",
          barcode: form.barcode.trim() || undefined,
          unit: form.unit.trim() || undefined,
          description: form.description.trim() || undefined,
          costPrice: Number(form.costPrice) || 0,
          price: Number(form.price) || 0,
          stock: Number(form.stock) || 0,
          minStock: Number(form.minStock) || 0,
          attributes: {
            ...Object.fromEntries(
              mode.fields
                .filter((f) => attrs[f.key]?.trim())
                .map((f) => [
                  f.key,
                  f.type === "number" ? Number(attrs[f.key]) : attrs[f.key]!.trim(),
                ]),
            ),
            ...(!hasSoldBy && attrs["sold_by"]?.trim()
              ? { sold_by: attrs["sold_by"]!.trim() }
              : {}),
          },
        },
        product?.id,
      );
      toast.success(product ? "Product queued for update" : "Product queued for add");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/60 p-4">
      <form
        onSubmit={save}
        className="panel clip-cut-card w-full max-w-md space-y-4 p-6"
      >
        <h3 className="font-display text-xl font-bold tracking-tight text-gold">
          {product ? "Edit" : "Add"} {mode.itemSingular}
        </h3>
        <p className="-mt-2 text-[11px] text-muted-foreground">
          Only Name and Price are required — every other field is optional so the system fits any business.
        </p>
        <Field label="Name *">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <input
              list="mode-categories"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input"
              placeholder={mode.categories[0]}
            />
            <datalist id="mode-categories">
              {mode.categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Unit">
            <input
              list="unit-suggestions"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="input"
              placeholder="pcs, kg, ltr, box…"
            />
            <datalist id="unit-suggestions">
              {UNIT_SUGGESTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Field>
          {!hasSoldBy && (
            <Field label="Sold By">
              <select
                value={attrs["sold_by"] ?? ""}
                onChange={(e) => setAttrs({ ...attrs, sold_by: e.target.value })}
                className="input"
              >
                <option value="">Piece (whole units)</option>
                <option value="Weight">Weight (kg / gm — half, quarter…)</option>
                <option value="Volume">Volume (ltr / ml)</option>
              </select>
            </Field>
          )}
          <Field label="Barcode / SKU">
            <input
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Cost Price">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Selling Price *">
            <input
              required
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Stock">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Min Stock">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
              className="input"
            />
          </Field>
        </div>
        {mode.fields.length > 0 && (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-gold">
              {mode.label} details
            </div>
            <div className="grid grid-cols-2 gap-3">
              {mode.fields.map((f) => (
                <Field key={f.key} label={f.label}>
                  {f.type === "select" ? (
                    <select
                      value={attrs[f.key] ?? ""}
                      onChange={(e) => setAttrs({ ...attrs, [f.key]: e.target.value })}
                      className="input"
                    >
                      <option value="">—</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={attrs[f.key] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => setAttrs({ ...attrs, [f.key]: e.target.value })}
                      className="input"
                    />
                  )}
                </Field>
              ))}
            </div>
          </div>
        )}

        <Field label="Description">
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input"
          />
        </Field>
        <div className="flex gap-2 pt-2">
          <GoldButton type="submit" className="flex-1" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </GoldButton>
          <GoldButton
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </GoldButton>
        </div>
        <style>{`.input{width:100%;border-radius:0.375rem;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.4);padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:color-mix(in oklab,var(--gold) 60%,transparent)}`}</style>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function AttrCell({
  product,
  field,
  expiryKey,
}: {
  product: Product;
  field: ModeField;
  expiryKey?: string;
}) {
  const raw = (product.attributes ?? {})[field.key];
  if (raw == null || raw === "") return <span className="opacity-40">—</span>;
  if (field.key === expiryKey) {
    const d = daysUntil(raw);
    const tone =
      d == null ? "" : d < 0 ? "text-red-400 font-bold" : d <= 30 ? "text-amber-400 font-bold" : "";
    return (
      <span className={tone}>
        {String(raw)}
        {d != null && d < 0 && " · expired"}
        {d != null && d >= 0 && d <= 30 && ` · ${d}d`}
      </span>
    );
  }
  return <span>{String(raw)}</span>;
}

function ExpiryAlerts({ products, field }: { products: Product[]; field: string }) {
  const flagged = products
    .map((p) => ({ p, d: daysUntil((p.attributes ?? {})[field]) }))
    .filter((x) => x.d != null && x.d <= 30)
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
  if (flagged.length === 0) return null;
  return (
    <div className="panel clip-cut-card border-amber-400/40 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
        Expiry alerts · {flagged.length}
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {flagged.slice(0, 6).map(({ p, d }) => (
          <li key={p.id} className="flex justify-between gap-3">
            <span className="truncate font-semibold">{p.name}</span>
            <span className={(d ?? 0) < 0 ? "text-red-400" : "text-amber-400"}>
              {(d ?? 0) < 0 ? `expired ${Math.abs(d ?? 0)}d ago` : `${d}d left`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
