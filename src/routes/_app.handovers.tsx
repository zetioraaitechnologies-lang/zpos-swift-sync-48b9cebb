import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { useLive, listProducts, type Product } from "@/lib/zpos-data";
import {
  listHandovers,
  createHandover,
  updateHandover,
  deleteHandover,
  handoverVariance,
  type Handover,
} from "@/lib/zpos-ops";
import { fmtQty } from "@/lib/weighing";

export const Route = createFileRoute("/_app/handovers")({
  component: Handovers,
  head: () => ({
    meta: [
      { title: "Kitchen & Staff Handovers · ZPOS" },
      {
        name: "description",
        content:
          "Record what the kitchen or store issued, what staff received, sold and returned — with automatic variance.",
      },
      { property: "og:title", content: "Kitchen & Staff Handovers · ZPOS" },
      {
        property: "og:description",
        content: "Track issued, received, sold and returned quantities per staff member.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Handovers() {
  const { org, user } = useAuth();
  const { data: rows, loading, refresh } = useLive<Handover[]>(
    org?.id,
    ["handovers"],
    listHandovers,
    [],
  );
  const { data: products } = useLive<Product[]>(org?.id, ["products"], listProducts, []);
  const [show, setShow] = useState(false);
  const [filter, setFilter] = useState<"open" | "closed" | "all">("open");

  if (!org || !user) return null;

  const list = rows.filter((r) => filter === "all" || r.status === filter);

  const patch = async (h: Handover, p: Partial<Handover>) => {
    try {
      await updateHandover(h.id, p as never);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Handovers</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${list.length} records`} · issued → received → sold → returned
          </p>
        </div>
        <GoldButton onClick={() => setShow(true)}>
          <Plus className="h-4 w-4" /> New handover
        </GoldButton>
      </div>

      <div className="flex gap-2">
        {(["open", "closed", "all"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-none border px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${
              filter === k
                ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-gold"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((h) => {
          const variance = handoverVariance(h);
          return (
            <div key={h.id} className="panel clip-cut-card space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-display font-bold text-gold">{h.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {h.staffName} · {new Date(h.createdAt).toLocaleString()}
                  </div>
                </div>
                <span
                  className={`rounded-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                    h.status === "closed" ? "bg-secondary text-muted-foreground" : "bg-[color:var(--gold)]/15 text-gold"
                  }`}
                >
                  {h.status}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <Cell label="Issued" value={fmtQty(h.issuedQty)} />
                <NumCell
                  label="Received"
                  value={h.receivedQty}
                  disabled={h.status === "closed"}
                  onChange={(v) => patch(h, { receivedQty: v })}
                />
                <NumCell
                  label="Sold"
                  value={h.soldQty}
                  disabled={h.status === "closed"}
                  onChange={(v) => patch(h, { soldQty: v })}
                />
                <NumCell
                  label="Returned"
                  value={h.returnedQty}
                  disabled={h.status === "closed"}
                  onChange={(v) => patch(h, { returnedQty: v })}
                />
              </div>

              <div
                className={`text-xs font-bold ${variance === 0 ? "text-muted-foreground" : "text-red-400"}`}
              >
                Variance: {fmtQty(variance)} {h.unit ?? ""}
              </div>

              <div className="flex gap-2">
                {h.status === "open" && (
                  <button
                    onClick={() => patch(h, { status: "closed" })}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-none border border-border px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest hover:bg-secondary"
                  >
                    <Check className="h-3.5 w-3.5" /> Close
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (!confirm("Delete this handover?")) return;
                    await deleteHandover(h.id);
                    await refresh();
                  }}
                  className="inline-flex items-center justify-center gap-1 rounded-none border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        {!loading && list.length === 0 && (
          <div className="panel clip-cut-card col-span-full p-8 text-center text-muted-foreground">
            No handovers yet.
          </div>
        )}
      </div>

      {show && (
        <HandoverForm
          products={products}
          onClose={() => setShow(false)}
          onDone={async () => {
            setShow(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none border border-border bg-secondary p-2">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

function NumCell({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const [v, setV] = useState(String(value));
  return (
    <div className="rounded-none border border-border bg-secondary p-2">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <input
        type="number"
        inputMode="decimal"
        disabled={disabled}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onChange(Number(v) || 0)}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full bg-transparent text-center text-sm font-bold outline-none disabled:opacity-60"
      />
    </div>
  );
}

function HandoverForm({
  products,
  onClose,
  onDone,
}: {
  products: Product[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { org, user } = useAuth();
  const [f, setF] = useState({
    productId: "",
    productName: "",
    issuedQty: "",
    receivedQty: "",
    staffName: "",
    note: "",
  });
  const [busy, setBusy] = useState(false);
  if (!org || !user) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const p = products.find((x) => x.id === f.productId);
      await createHandover(org.id, user.id, {
        productId: p?.id,
        productName: p?.name ?? f.productName,
        unit: p?.unit,
        issuedQty: Number(f.issuedQty) || 0,
        receivedQty: Number(f.receivedQty || f.issuedQty) || 0,
        staffName: f.staffName,
        note: f.note || undefined,
      });
      toast.success("Handover recorded");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const cls =
    "w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/60 p-4">
      <form onSubmit={save} className="panel clip-cut-card w-full max-w-md space-y-3 p-6">
        <h3 className="font-display text-xl font-bold text-gold">New handover</h3>
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
            Item
          </span>
          <select
            value={f.productId}
            onChange={(e) => setF({ ...f, productId: e.target.value })}
            className={cls}
          >
            <option value="">— Free text item —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {!f.productId && (
          <input
            required
            placeholder="Item name"
            value={f.productName}
            onChange={(e) => setF({ ...f, productName: e.target.value })}
            className={cls}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <input
            required
            type="number"
            step="any"
            placeholder="Issued qty"
            value={f.issuedQty}
            onChange={(e) => setF({ ...f, issuedQty: e.target.value })}
            className={cls}
          />
          <input
            type="number"
            step="any"
            placeholder="Received qty"
            value={f.receivedQty}
            onChange={(e) => setF({ ...f, receivedQty: e.target.value })}
            className={cls}
          />
        </div>
        <input
          required
          placeholder="Staff name (waiter / seller)"
          value={f.staffName}
          onChange={(e) => setF({ ...f, staffName: e.target.value })}
          className={cls}
        />
        <input
          placeholder="Note (optional)"
          value={f.note}
          onChange={(e) => setF({ ...f, note: e.target.value })}
          className={cls}
        />
        <div className="flex gap-2 pt-1">
          <GoldButton type="submit" className="flex-1" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </GoldButton>
          <GoldButton type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </GoldButton>
        </div>
      </form>
    </div>
  );
}
