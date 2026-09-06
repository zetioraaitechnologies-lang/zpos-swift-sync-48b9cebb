import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Printer, Eye, X } from "lucide-react";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { fmtMoney, useLive, listSales, type Sale } from "@/lib/zpos-data";
import { fmtQty } from "@/lib/weighing";

export const Route = createFileRoute("/_app/receipts")({
  component: Receipts,
  head: () => ({
    meta: [
      { title: "Receipt Center · ZPOS" },
      {
        name: "description",
        content:
          "Search, filter, view and reprint every sales receipt of your store in seconds.",
      },
      { property: "og:title", content: "Receipt Center · ZPOS" },
      {
        property: "og:description",
        content: "Search, filter, view and reprint every sales receipt.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PAYMENTS = ["all", "cash", "mobile", "bank", "credit"] as const;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function Receipts() {
  const { org } = useAuth();
  const { data: sales, loading } = useLive<Sale[]>(org?.id, ["sales"], listSales, []);

  const [q, setQ] = useState("");
  const [pay, setPay] = useState<(typeof PAYMENTS)[number]>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [quick, setQuick] = useState<"all" | "today" | "7d" | "30d">("all");
  const [view, setView] = useState<Sale | null>(null);

  const filtered = useMemo(() => {
    const now = Date.now();
    const day = 86400000;
    const quickFrom =
      quick === "today"
        ? startOfDay(new Date())
        : quick === "7d"
          ? now - 7 * day
          : quick === "30d"
            ? now - 30 * day
            : 0;
    const fromTs = from ? new Date(from).getTime() : quickFrom;
    const toTs = to ? new Date(to).getTime() + day : Infinity;
    const ql = q.trim().toLowerCase();
    const minN = min ? Number(min) : -Infinity;
    const maxN = max ? Number(max) : Infinity;

    return sales.filter((s) => {
      if (s.createdAt < fromTs || s.createdAt > toTs) return false;
      if (pay !== "all" && s.payment !== pay) return false;
      if (s.total < minN || s.total > maxN) return false;
      if (!ql) return true;
      return (
        s.id.toLowerCase().includes(ql) ||
        (s.customerName ?? "").toLowerCase().includes(ql) ||
        s.items.some((i) => i.name.toLowerCase().includes(ql))
      );
    });
  }, [sales, q, pay, from, to, min, max, quick]);

  const total = filtered.reduce((a, s) => a + s.total, 0);

  if (!org) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Receipt Center</h1>
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${filtered.length} receipts · ${fmtMoney(total, org.currency)}`}
        </p>
      </div>

      <div className="panel clip-cut-card space-y-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Receipt no, customer or product…"
            className="w-full rounded-none border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "today", "7d", "30d"] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                setQuick(k);
                setFrom("");
                setTo("");
              }}
              className={`rounded-none border px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${
                quick === k
                  ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-gold"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {k === "all" ? "All time" : k === "today" ? "Today" : k === "7d" ? "7 days" : "30 days"}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="From">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </Field>
          <Field label="To">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Payment">
            <select value={pay} onChange={(e) => setPay(e.target.value as never)} className={inputCls}>
              {PAYMENTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Min total">
            <input type="number" value={min} onChange={(e) => setMin(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Max total">
            <input type="number" value={max} onChange={(e) => setMax(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="panel clip-cut-card divide-y divide-border">
        {filtered.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-sm font-bold text-gold">
                #{s.id.slice(0, 8).toUpperCase()}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {new Date(s.createdAt).toLocaleString()} · {s.items.length} items ·{" "}
                {s.customerName ?? "Walk-in"} · {s.payment}
              </div>
            </div>
            <div className="text-right text-sm font-bold">{fmtMoney(s.total, org.currency)}</div>
            <button
              onClick={() => setView(s)}
              className="inline-flex items-center gap-1 rounded-none border border-border px-2 py-1 text-[11px] font-bold uppercase tracking-widest hover:bg-secondary"
            >
              <Eye className="h-3.5 w-3.5" /> View
            </button>
            <button
              onClick={() => {
                setView(s);
                setTimeout(() => window.print(), 250);
              }}
              className="inline-flex items-center gap-1 rounded-none border border-border px-2 py-1 text-[11px] font-bold uppercase tracking-widest hover:bg-secondary"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">No receipts match these filters.</div>
        )}
      </div>

      {view && <ReceiptModal sale={view} onClose={() => setView(null)} />}
    </div>
  );
}

const inputCls =
  "w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60";

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

function ReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { org } = useAuth();
  if (!org) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/60 p-4 print:static print:bg-transparent print:p-0">
      <div className="panel clip-cut-card w-full max-w-sm p-5 print:max-w-none print:border-0 print:shadow-none">
        <div className="flex items-start justify-between print:hidden">
          <h3 className="font-display text-lg font-bold text-gold">Receipt</h3>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="mt-3 text-center">
          <div className="font-display text-base font-bold">{org.businessName}</div>
          {org.receiptHeader && <div className="text-xs text-muted-foreground">{org.receiptHeader}</div>}
          <div className="text-[11px] text-muted-foreground">
            #{sale.id.slice(0, 8).toUpperCase()} · {new Date(sale.createdAt).toLocaleString()}
          </div>
        </div>

        <div className="mt-4 space-y-1 border-y border-dashed border-border py-3 text-sm">
          {sale.items.map((i, idx) => (
            <div key={idx} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">
                {fmtQty(i.qty)} × {i.name}
              </span>
              <span>{fmtMoney(i.qty * i.price, org.currency)}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1 text-sm">
          <Line k="Subtotal" v={fmtMoney(sale.subtotal, org.currency)} />
          {sale.discount > 0 && <Line k="Discount" v={`- ${fmtMoney(sale.discount, org.currency)}`} />}
          <Line k="Total" v={fmtMoney(sale.total, org.currency)} bold />
          <Line k="Paid" v={fmtMoney(sale.amountPaid, org.currency)} />
          {sale.total - sale.amountPaid > 0 && (
            <Line k="Balance" v={fmtMoney(sale.total - sale.amountPaid, org.currency)} />
          )}
          <Line k="Payment" v={sale.payment} />
          <Line k="Customer" v={sale.customerName ?? "Walk-in"} />
        </div>

        {org.receiptFooter && (
          <div className="mt-3 text-center text-[11px] text-muted-foreground">{org.receiptFooter}</div>
        )}

        <div className="mt-4 flex gap-2 print:hidden">
          <GoldButton className="flex-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </GoldButton>
          <GoldButton variant="outline" className="flex-1" onClick={onClose}>
            Close
          </GoldButton>
        </div>
      </div>
    </div>
  );
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span className="text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}
