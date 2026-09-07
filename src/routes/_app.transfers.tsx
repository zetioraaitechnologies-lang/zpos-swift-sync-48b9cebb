import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeftRight, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { useLive, listProducts, type Product } from "@/lib/zpos-data";
import {
  listTransfers,
  createTransfer,
  receiveTransfer,
  cancelTransfer,
  type StoreTransfer,
} from "@/lib/zpos-ops";
import { fmtQty } from "@/lib/weighing";

export const Route = createFileRoute("/_app/transfers")({
  component: Transfers,
  head: () => ({
    meta: [
      { title: "Store Transfers · ZPOS" },
      {
        name: "description",
        content:
          "Move stock between your branches and keep a permanent record of every transfer sent and received.",
      },
      { property: "og:title", content: "Store Transfers · ZPOS" },
      {
        property: "og:description",
        content: "Branch-to-branch stock movements with pending, received and cancelled states.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Transfers() {
  const { org, orgs } = useAuth();
  const { data: rows, loading, refresh } = useLive<StoreTransfer[]>(
    org?.id,
    ["store_transfers", "products"],
    listTransfers,
    [],
  );
  const [show, setShow] = useState(false);
  const [tab, setTab] = useState<"all" | "out" | "in">("all");

  if (!org) return null;

  const list = rows.filter((r) =>
    tab === "all" ? true : tab === "out" ? r.fromOrgId === org.id : r.toOrgId === org.id,
  );
  const nameOf = (id: string) => orgs.find((o) => o.id === id)?.name ?? "Other store";

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Transfers</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${list.length} movements`}
          </p>
        </div>
        <GoldButton onClick={() => setShow(true)}>
          <ArrowLeftRight className="h-4 w-4" /> New transfer
        </GoldButton>
      </div>

      <div className="flex gap-2">
        {(["all", "out", "in"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`clip-cut-sm border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest ${
              tab === t
                ? "border-transparent bg-gold-gradient text-on-accent"
                : "border-border text-muted-foreground"
            }`}
          >
            {t === "all" ? "All" : t === "out" ? "Sent out" : "Incoming"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {list.map((t) => {
          const outgoing = t.fromOrgId === org.id;
          return (
            <div key={t.id} className="panel clip-cut-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display font-bold text-gold">{t.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {outgoing ? "To" : "From"}{" "}
                    {nameOf(outgoing ? t.toOrgId : t.fromOrgId)} ·{" "}
                    {new Date(t.createdAt).toLocaleString()}
                  </div>
                  {t.note && <div className="mt-1 text-xs">{t.note}</div>}
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-bold">
                    {fmtQty(t.qty)} {t.unit ?? ""}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t.status}
                  </div>
                </div>
              </div>

              {t.status === "pending" && (
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  {!outgoing && (
                    <button
                      onClick={() => act(() => receiveTransfer(t.id), "Stock received")}
                      className="inline-flex items-center gap-2 clip-cut-sm bg-gold-gradient px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-on-accent"
                    >
                      <Check className="h-3.5 w-3.5" /> Receive
                    </button>
                  )}
                  {outgoing && (
                    <button
                      onClick={() => act(() => cancelTransfer(t.id), "Transfer cancelled")}
                      className="inline-flex items-center gap-2 clip-cut-sm border border-red-400/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-red-300"
                    >
                      <X className="h-3.5 w-3.5" /> Cancel & return stock
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!loading && list.length === 0 && (
          <div className="panel clip-cut-card p-8 text-center text-muted-foreground">
            No transfers yet.
          </div>
        )}
      </div>

      {show && (
        <TransferForm
          onClose={() => setShow(false)}
          onDone={() => {
            setShow(false);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function TransferForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { org, orgs } = useAuth();
  const { data: products } = useLive<Product[]>(org?.id, ["products"], listProducts, []);
  const targets = orgs.filter((o) => o.id !== org?.id);
  const [f, setF] = useState({ productId: "", toOrgId: "", qty: "", note: "" });
  const [busy, setBusy] = useState(false);
  if (!org) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createTransfer({
        fromOrgId: org.id,
        toOrgId: f.toOrgId,
        productId: f.productId,
        qty: Number(f.qty),
        note: f.note || undefined,
      });
      toast.success("Transfer sent — the other store can now receive it.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send transfer");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/50 p-4">
      <form onSubmit={save} className="panel clip-cut-card w-full max-w-md space-y-4 p-6">
        <h3 className="font-display text-xl font-bold tracking-tight text-gold">
          New transfer
        </h3>
        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You only have one store, so there is nowhere to transfer to yet.
          </p>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Destination store
              </span>
              <select
                required
                value={f.toOrgId}
                onChange={(e) => setF({ ...f, toOrgId: e.target.value })}
                className={input}
              >
                <option value="">Choose…</option>
                {targets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Item
              </span>
              <select
                required
                value={f.productId}
                onChange={(e) => setF({ ...f, productId: e.target.value })}
                className={input}
              >
                <option value="">Choose…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {fmtQty(p.stock)} {p.unit ?? ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Quantity
              </span>
              <input
                required
                type="number"
                step="any"
                min="0"
                value={f.qty}
                onChange={(e) => setF({ ...f, qty: e.target.value })}
                className={input}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Note (optional)
              </span>
              <input
                value={f.note}
                onChange={(e) => setF({ ...f, note: e.target.value })}
                className={input}
              />
            </label>
          </>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 clip-cut-sm border border-border py-2 text-[11px] font-bold uppercase tracking-widest"
          >
            Close
          </button>
          {targets.length > 0 && (
            <GoldButton type="submit" disabled={busy} className="flex-1 justify-center">
              {busy ? "Sending…" : "Send"}
            </GoldButton>
          )}
        </div>
      </form>
    </div>
  );
}
