import { createFileRoute } from "@tanstack/react-router";
import { DollarSign, TrendingUp, Package, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Line,
  LineChart,
} from "recharts";
import { StatCard } from "@/components/zpos/stat-card";
import {
  fmtMoney,
  useLive,
  listProducts,
  listSales,
  type Product,
  type Sale,
} from "@/lib/zpos-data";
import { useAuth } from "@/lib/zpos-auth";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { org } = useAuth();
  const { data: products } = useLive<Product[]>(org?.id, ["products"], listProducts, []);
  const { data: sales } = useLive<Sale[]>(org?.id, ["sales"], listSales, []);

  if (!org) return null;
  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const todaySales = sales.filter((s) => s.createdAt >= today0.getTime());
  const todayRevenue = todaySales.reduce((a, s) => a + s.total, 0);
  const todayProfit = todaySales.reduce((a, s) => a + s.profit, 0);
  const lowStock = products.filter((p) => p.stock <= p.minStock);

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    const next = d.getTime() + 86400000;
    const dSales = sales.filter((s) => s.createdAt >= d.getTime() && s.createdAt < next);
    return {
      day: d.toLocaleDateString(undefined, { weekday: "short" }),
      revenue: dSales.reduce((a, s) => a + s.total, 0),
      count: dSales.length,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black uppercase tracking-wider">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Overview for {org.businessName} · {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's Sales" value={String(todaySales.length)} hint="transactions" icon={TrendingUp} />
        <StatCard label="Today's Revenue" value={fmtMoney(todayRevenue, org.currency)} icon={DollarSign} accent />
        <StatCard label="Today's Profit" value={fmtMoney(todayProfit, org.currency)} icon={TrendingUp} />
        <StatCard label="Low Stock" value={String(lowStock.length)} hint={`${products.length} total products`} icon={AlertTriangle} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel clip-cut-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-bold uppercase tracking-widest text-gold">
              Revenue · Last 7 days
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={days}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
                <XAxis dataKey="day" stroke="oklch(0.7 0 0)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0 0)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.18 0.008 60)",
                    border: "1px solid var(--gold)",
                    borderRadius: 6,
                  }}
                  labelStyle={{ color: "var(--gold)" }}
                />
                <Bar dataKey="revenue" fill="var(--gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel clip-cut-card p-5">
          <h3 className="mb-4 font-display font-bold uppercase tracking-widest text-gold">
            Transactions
          </h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={days}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
                <XAxis dataKey="day" stroke="oklch(0.7 0 0)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0 0)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.008 60)", border: "1px solid var(--gold)", borderRadius: 6 }} />
                <Line type="monotone" dataKey="count" stroke="var(--gold)" strokeWidth={2} dot={{ fill: "var(--gold)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel clip-cut-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-bold uppercase tracking-widest text-gold">
              Recent Sales
            </h3>
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          {sales.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No sales yet. Head to POS to make your first sale.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {sales.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-sm font-semibold">
                      {s.items.length} item{s.items.length > 1 ? "s" : ""}
                    </div>
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      {new Date(s.createdAt).toLocaleTimeString()} · {s.payment}
                    </div>
                  </div>
                  <div className="font-display font-bold text-gold">
                    {fmtMoney(s.total, org.currency)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel clip-cut-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-bold uppercase tracking-widest text-gold">
              Low Stock Alert
            </h3>
            <AlertTriangle className="h-4 w-4 text-amber-300" />
          </div>
          {lowStock.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              All stock levels are healthy.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      Min {p.minStock}
                    </div>
                  </div>
                  <div className="font-display font-bold text-amber-300">
                    {p.stock} left
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
