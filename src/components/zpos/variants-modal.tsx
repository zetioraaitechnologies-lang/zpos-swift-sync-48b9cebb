import { useState } from "react";
import { X, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, useLive, type Product } from "@/lib/zpos-data";
import {
  listVariants,
  upsertVariant,
  deleteVariant,
  variantLabel,
  type ProductVariant,
} from "@/lib/zpos-trade";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";

const EMPTY = { size: "", color: "", barcode: "", price: "", costPrice: "", stock: "0" };

export function VariantsModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { org } = useAuth();
  const { data: all, refresh } = useLive<ProductVariant[]>(
    org?.id,
    ["product_variants"],
    listVariants,
    [],
  );
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!org) return null;
  const variants = all.filter((v) => v.productId === product.id);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.size.trim() && !form.color.trim()) {
      return toast.error("Enter a size or a colour");
    }
    setBusy(true);
    try {
      await upsertVariant(
        org.id,
        product.id,
        {
          size: form.size.trim() || undefined,
          color: form.color.trim() || undefined,
          barcode: form.barcode.trim() || undefined,
          price: form.price === "" ? undefined : Number(form.price),
          costPrice: form.costPrice === "" ? undefined : Number(form.costPrice),
          stock: Number(form.stock) || 0,
        },
        editId ?? undefined,
      );
      toast.success(editId ? "Variant updated" : "Variant added");
      setForm({ ...EMPTY });
      setEditId(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (v: ProductVariant) => {
    if (!confirm(`Delete variant ${variantLabel(v)}?`)) return;
    try {
      await deleteVariant(v.id);
      toast.success("Variant deleted");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/60 p-4">
      <div className="panel clip-cut-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold uppercase tracking-widest text-gold">
              Variants
            </h3>
            <p className="text-xs text-muted-foreground">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1">
          {variants.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-2 border border-border bg-secondary px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{variantLabel(v)}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {fmtMoney(v.price ?? product.price, org.currency)} · {v.stock} in stock
                  {v.barcode ? ` · ${v.barcode}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditId(v.id);
                    setForm({
                      size: v.size ?? "",
                      color: v.color ?? "",
                      barcode: v.barcode ?? "",
                      price: v.price?.toString() ?? "",
                      costPrice: v.costPrice?.toString() ?? "",
                      stock: String(v.stock),
                    });
                  }}
                  className="text-[10px] font-semibold uppercase tracking-widest text-gold"
                >
                  Edit
                </button>
                <button onClick={() => remove(v)} className="text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {variants.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No variants yet — add size / colour rows below.
            </div>
          )}
        </div>

        <form onSubmit={save} className="mt-4 space-y-2 border-t border-border pt-4">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Size" value={form.size} onChange={(v) => setForm({ ...form, size: v })} />
            <Field label="Colour" value={form.color} onChange={(v) => setForm({ ...form, color: v })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Price" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
            <Field label="Cost" type="number" value={form.costPrice} onChange={(v) => setForm({ ...form, costPrice: v })} />
            <Field label="Stock" type="number" value={form.stock} onChange={(v) => setForm({ ...form, stock: v })} />
          </div>
          <Field label="Barcode" value={form.barcode} onChange={(v) => setForm({ ...form, barcode: v })} />
          <div className="flex gap-2">
            <GoldButton type="submit" className="flex-1" disabled={busy}>
              <Plus className="h-4 w-4" /> {editId ? "Update variant" : "Add variant"}
            </GoldButton>
            {editId && (
              <GoldButton
                type="button"
                variant="outline"
                onClick={() => { setEditId(null); setForm({ ...EMPTY }); }}
              >
                Cancel
              </GoldButton>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        step={type === "number" ? "any" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-none border border-border bg-input px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
      />
    </label>
  );
}
