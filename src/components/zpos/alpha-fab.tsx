import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { zdb, fmtMoney } from "@/lib/zpos-db";
import { useAuth } from "@/lib/zpos-auth";
import { askAlpha, type AlphaSnapshot } from "@/lib/alpha.functions";
import { cn } from "@/lib/utils";

interface Msg {
  from: "user" | "alpha";
  text: string;
}

export function AlphaFab() {
  const { org, user } = useAuth();
  const ask = useServerFn(askAlpha);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      from: "alpha",
      text:
        "Habari! Mimi ni Alpha AI. Uliza chochote kuhusu biashara yako — mauzo, hisa, matumizi. / Ask me anything about your sales, stock or expenses.",
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open, busy]);

  if (!user || user.role === "super_admin") return null;

  const buildSnapshot = (): AlphaSnapshot | null => {
    if (!org) return null;
    const db = zdb.get();
    const orgId = org.id;
    const t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    const sales = db.sales.filter((s) => s.orgId === orgId);
    const todaySales = sales.filter((s) => s.createdAt >= t0.getTime());
    const products = db.products.filter((p) => p.orgId === orgId);
    const expenses = db.expenses.filter((e) => e.orgId === orgId);
    const map = new Map<string, number>();
    sales.forEach((s) =>
      s.items.forEach((i) => map.set(i.name, (map.get(i.name) ?? 0) + i.qty)),
    );
    const topProducts = [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));
    return {
      businessName: org.businessName,
      currency: org.currency,
      todaySales: {
        count: todaySales.length,
        total: todaySales.reduce((a, s) => a + s.total, 0),
      },
      totalRevenue: sales.reduce((a, s) => a + s.total, 0),
      totalProfit: sales.reduce((a, s) => a + s.profit, 0),
      totalExpenses: expenses.reduce((a, e) => a + e.amount, 0),
      lowStock: products
        .filter((p) => p.stock <= p.minStock)
        .slice(0, 10)
        .map((p) => ({ name: p.name, stock: p.stock, min: p.minStock })),
      topProducts,
      productCount: products.length,
    };
  };

  const offlineAnswer = (q: string): string => {
    const snap = buildSnapshot();
    if (!snap) return "No business selected.";
    const ql = q.toLowerCase();
    const sw = /(leo|mauzo|hisa|matumizi|bidhaa|faida|mapato)/.test(ql);
    if (/(today|leo)/.test(ql))
      return sw
        ? `Leo umeuza ${snap.todaySales.count} muamala, jumla ${fmtMoney(snap.todaySales.total, snap.currency)}.`
        : `Today: ${snap.todaySales.count} sales, ${fmtMoney(snap.todaySales.total, snap.currency)}.`;
    if (/(revenue|mapato)/.test(ql))
      return `${sw ? "Mapato" : "Revenue"}: ${fmtMoney(snap.totalRevenue, snap.currency)}.`;
    if (/(profit|faida)/.test(ql))
      return `${sw ? "Faida" : "Profit"}: ${fmtMoney(snap.totalProfit, snap.currency)}.`;
    if (/(expense|matumizi)/.test(ql))
      return `${sw ? "Matumizi" : "Expenses"}: ${fmtMoney(snap.totalExpenses, snap.currency)}.`;
    if (/(stock|hisa)/.test(ql))
      return snap.lowStock.length
        ? "Low stock: " + snap.lowStock.map((p) => `${p.name} (${p.stock})`).join(", ")
        : sw ? "Hisa zote ni salama." : "All stock healthy.";
    if (/(top|zaidi)/.test(ql))
      return snap.topProducts.length
        ? "Top: " + snap.topProducts.slice(0, 3).map((p) => `${p.name} (${p.qty})`).join(", ")
        : sw ? "Bado hakuna mauzo." : "No sales yet.";
    return sw
      ? "Uko nje ya mtandao. Nitajibu ukirudi online."
      : "You're offline. Reconnect to ask Alpha for smarter answers.";
  };

  const send = async () => {
    if (!input.trim() || busy) return;
    const q = input.trim();
    setInput("");
    setMsgs((m) => [...m, { from: "user", text: q }]);

    const snap = buildSnapshot();
    if (!snap) {
      setMsgs((m) => [...m, { from: "alpha", text: "No business selected." }]);
      return;
    }

    if (!online) {
      setMsgs((m) => [...m, { from: "alpha", text: offlineAnswer(q) }]);
      return;
    }

    setBusy(true);
    try {
      const res = await ask({ data: { question: q, snapshot: snap } });
      setMsgs((m) => [...m, { from: "alpha", text: res.text || offlineAnswer(q) }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Alpha is unavailable.";
      setMsgs((m) => [
        ...m,
        { from: "alpha", text: `${msg}\n\n(Offline answer) ${offlineAnswer(q)}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-gold-gradient text-black shadow-[0_10px_30px_-8px_var(--gold)] transition hover:scale-105 print:hidden"
        aria-label="Alpha AI"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      <div
        className={cn(
          "panel fixed bottom-24 right-5 z-40 flex w-[92vw] max-w-sm flex-col overflow-hidden rounded-xl border border-[color:var(--gold)]/30 shadow-2xl transition-all print:hidden",
          open ? "opacity-100 translate-y-0" : "pointer-events-none translate-y-4 opacity-0",
        )}
        style={{ height: "min(70vh, 520px)" }}
      >
        <div className="flex items-center gap-3 border-b border-[color:var(--gold)]/20 bg-muted/60 px-4 py-3">
          <div className="grid h-8 w-8 place-items-center bg-gold-gradient clip-cut-sm">
            <Sparkles className="h-4 w-4 text-black" />
          </div>
          <div className="flex-1">
            <div className="font-display text-sm font-bold text-gold">Alpha AI</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {online ? "Powered by Lovable AI" : "Offline mode"}
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
          {msgs.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2",
                m.from === "user"
                  ? "ml-auto bg-gold-gradient text-black"
                  : "bg-muted text-foreground",
              )}
            >
              {m.text}
            </div>
          ))}
          {busy && (
            <div className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="flex gap-2 border-t border-[color:var(--gold)]/20 bg-muted/40 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={busy}
            placeholder={online ? "Ask Alpha…" : "Offline — basic answers only"}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60 disabled:opacity-60"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="grid h-10 w-10 place-items-center rounded-md bg-gold-gradient text-black disabled:opacity-50"
            aria-label="Send"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </>
  );
}
