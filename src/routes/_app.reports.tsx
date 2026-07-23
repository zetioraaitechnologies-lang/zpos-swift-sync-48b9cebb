import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { zdb, fmtMoney } from "@/lib/zpos-db";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";

export const Route = createFileRoute("/_app/reports")({
  component: Reports,
});

function Reports() {
  const { org } = useAuth();
  const [, setV] = useState(0);
  useEffect(() => {
    const u = zdb.subscribe(() => setV((n) => n + 1));
    return () => { u(); };
  }, []);
  const [range, setRange] = useState<"day" | "week" | "month">("week");

  if (!org) return null;
  const db = zdb.get();
  const now = new Date();
  const from = new Date(now);
  if (range === "day") from.setHours(0, 0, 0, 0);
  else if (range === "week") from.setDate(now.getDate() - 7);
  else from.setMonth(now.getMonth() - 1);

  const sales = db.sales.filter(
    (s) => s.orgId === org.id && s.createdAt >= from.getTime(),
  );
  const expenses = db.expenses.filter(
    (e) => e.orgId === org.id && e.createdAt >= from.getTime(),
  );
  const products = db.products.filter((p) => p.orgId === org.id);

  const revenue = sales.reduce((a, s) => a + s.total, 0);
  const profit = sales.reduce((a, s) => a + s.profit, 0);
  const expTotal = expenses.reduce((a, e) => a + e.amount, 0);
  const net = profit - expTotal;
  const lowStock = products.filter((p) => p.stock <= p.minStock);

  const exportPdf = () => {
    const doc = new jsPDF();
    const cur = org.currency;
    doc.setFontSize(18);
    doc.text(`${org.businessName} — Report`, 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `${range.toUpperCase()} · ${from.toLocaleDateString()} – ${now.toLocaleDateString()}`,
      14,
      25,
    );
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 32,
      head: [["Metric", "Value"]],
      body: [
        ["Revenue", fmtMoney(revenue, cur)],
        ["Profit", fmtMoney(profit, cur)],
        ["Expenses", fmtMoney(expTotal, cur)],
        ["Net", fmtMoney(net, cur)],
      ],
      theme: "grid",
      headStyles: { fillColor: [180, 140, 60] },
    });

    autoTable(doc, {
      head: [["Date", "Items", "Payment", "Total"]],
      body: sales
        .slice()
        .reverse()
        .map((s) => [
          new Date(s.createdAt).toLocaleString(),
          String(s.items.length),
          s.payment.toUpperCase(),
          fmtMoney(s.total, cur),
        ]),
      theme: "striped",
      headStyles: { fillColor: [180, 140, 60] },
      styles: { fontSize: 8 },
    });

    if (lowStock.length) {
      autoTable(doc, {
        head: [["Low Stock Product", "Stock", "Min"]],
        body: lowStock.map((p) => [p.name, String(p.stock), String(p.minStock)]),
        theme: "grid",
        headStyles: { fillColor: [200, 90, 60] },
      });
    }

    doc.save(
      `${org.businessName.replace(/\s+/g, "_")}_${range}_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-wider">
            Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            {org.businessName} · {from.toLocaleDateString()} – {now.toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {(["day", "week", "month"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md border px-4 py-2 text-xs font-bold uppercase tracking-widest ${
                range === r
                  ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-gold"
                  : "border-white/10 text-muted-foreground hover:bg-white/5"
              }`}
            >
              {r}
            </button>
          ))}
          <GoldButton onClick={exportPdf} size="sm">
            <FileDown className="h-4 w-4" /> Export
          </GoldButton>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Revenue" value={fmtMoney(revenue, org.currency)} accent />
        <Metric label="Profit" value={fmtMoney(profit, org.currency)} />
        <Metric label="Expenses" value={fmtMoney(expTotal, org.currency)} />
        <Metric label="Net" value={fmtMoney(net, org.currency)} accent />
      </div>

      <Section title={`Sales (${sales.length})`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="p-2">Date</th>
              <th className="p-2">Items</th>
              <th className="p-2">Payment</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.slice().reverse().map((s) => (
              <tr key={s.id} className="border-b border-white/5 last:border-0">
                <td className="p-2 text-muted-foreground">
                  {new Date(s.createdAt).toLocaleString()}
                </td>
                <td className="p-2">{s.items.length}</td>
                <td className="p-2 uppercase text-muted-foreground">{s.payment}</td>
                <td className="p-2 text-right font-bold text-gold">
                  {fmtMoney(s.total, org.currency)}
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  No sales in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <Section title={`Inventory · Low Stock (${lowStock.length})`}>
        {lowStock.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            All stock levels healthy.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {lowStock.map((p) => (
              <li key={p.id} className="flex justify-between py-2 text-sm">
                <span>{p.name}</span>
                <span className="font-bold text-amber-300">
                  {p.stock} / min {p.minStock}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="panel clip-cut-card p-5">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-2 font-display text-2xl font-black ${accent ? "text-gold" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel clip-cut-card p-5">
      <h3 className="mb-3 font-display font-bold uppercase tracking-widest text-gold">
        {title}
      </h3>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
