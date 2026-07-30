import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  fmtMoney,
  useLive,
  listProducts,
  listSales,
  listExpenses,
  type Product,
  type Sale,
  type Expense,
} from "@/lib/zpos-data";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";

export const Route = createFileRoute("/_app/reports")({
  component: Reports,
});

function Reports() {
  const { org } = useAuth();
  const { data: sales } = useLive<Sale[]>(org?.id, ["sales"], listSales, []);
  const { data: expensesAll } = useLive<Expense[]>(org?.id, ["expenses"], listExpenses, []);
  const { data: products } = useLive<Product[]>(org?.id, ["products"], listProducts, []);
  const [range, setRange] = useState<"day" | "week" | "month">("week");

  if (!org) return null;
  const now = new Date();
  const from = new Date(now);
  if (range === "day") from.setHours(0, 0, 0, 0);
  else if (range === "week") from.setDate(now.getDate() - 7);
  else from.setMonth(now.getMonth() - 1);

  const inRange = sales.filter((s) => s.createdAt >= from.getTime());
  const expenses = expensesAll.filter((e) => e.createdAt >= from.getTime());

  const revenue = inRange.reduce((a, s) => a + s.total, 0);
  const profit = inRange.reduce((a, s) => a + s.profit, 0);
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
      body: inRange
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
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider">
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
              className={`rounded-none-none border px-4 py-2 text-xs font-bold uppercase tracking-widest ${
                range === r
                  ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-gold"
                  : "border-border text-muted-foreground hover:bg-secondary"
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

      <Section title={`Sales (${inRange.length})`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="p-2">Date</th>
              <th className="p-2">Items</th>
              <th className="p-2">Payment</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {inRange.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
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
            {inRange.length === 0 && (
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
          <ul className="divide-y divide-border">
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
      <div className={`mt-2 font-display text-2xl font-bold ${accent ? "text-gold" : ""}`}>
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
