import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { zdb, uid, fmtMoney, type Expense } from "@/lib/zpos-db";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";

const CATS: Expense["category"][] = [
  "Rent",
  "Salaries",
  "Electricity",
  "Transport",
  "Others",
];

export const Route = createFileRoute("/_app/expenses")({
  component: Expenses,
});

function Expenses() {
  const { org } = useAuth();
  const [, setV] = useState(0);
  useEffect(() => {
    const u = zdb.subscribe(() => setV((n) => n + 1));
    return () => { u(); };
  }, []);
  const [show, setShow] = useState(false);

  if (!org) return null;
  const items = zdb
    .get()
    .expenses.filter((e) => e.orgId === org.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  const total = items.reduce((a, e) => a + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-wider">
            Expenses
          </h1>
          <p className="text-sm text-muted-foreground">
            Total: <span className="font-bold text-gold">{fmtMoney(total, org.currency)}</span>
          </p>
        </div>
        <GoldButton onClick={() => setShow(true)}>
          <Plus className="h-4 w-4" /> Add Expense
        </GoldButton>
      </div>

      <div className="panel clip-cut-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="p-3">Date</th>
              <th className="p-3">Category</th>
              <th className="p-3">Note</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                <td className="p-3 text-muted-foreground">
                  {new Date(e.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3 font-semibold">{e.category}</td>
                <td className="p-3 text-muted-foreground">{e.note}</td>
                <td className="p-3 text-right font-bold text-gold">
                  {fmtMoney(e.amount, org.currency)}
                </td>
                <td className="p-3">
                  <button
                    onClick={() => {
                      if (!confirm("Delete expense?")) return;
                      zdb.update((d) => {
                        d.expenses = d.expenses.filter((x) => x.id !== e.id);
                      });
                    }}
                    className="grid h-8 w-8 place-items-center rounded hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No expenses recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {show && <ExpenseForm onClose={() => setShow(false)} />}
    </div>
  );
}

function ExpenseForm({ onClose }: { onClose: () => void }) {
  const { org } = useAuth();
  const [cat, setCat] = useState<Expense["category"]>("Rent");
  const [amt, setAmt] = useState(0);
  const [note, setNote] = useState("");
  if (!org) return null;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    zdb.update((d) => {
      d.expenses.push({
        id: uid("e"),
        orgId: org.id,
        category: cat,
        amount: amt,
        note,
        createdAt: Date.now(),
      });
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
      <form onSubmit={save} className="panel clip-cut-card w-full max-w-md space-y-4 p-6">
        <h3 className="font-display text-xl font-black uppercase tracking-widest text-gold">
          Add Expense
        </h3>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Category
          </span>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value as Expense["category"])}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          >
            {CATS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Amount
          </span>
          <input
            type="number"
            required
            min={0}
            value={amt}
            onChange={(e) => setAmt(+e.target.value)}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Note
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
        </label>
        <div className="flex gap-2 pt-2">
          <GoldButton type="submit" className="flex-1">Save</GoldButton>
          <GoldButton type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </GoldButton>
        </div>
      </form>
    </div>
  );
}
