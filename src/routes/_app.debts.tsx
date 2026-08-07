import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HandCoins } from "lucide-react";
import { fmtMoney, useLive, listSales, type Sale } from "@/lib/zpos-data";
import {
  listCustomerPayments,
  addCustomerPayment,
  buildDebts,
  type CustomerPayment,
  type DebtRow,
} from "@/lib/zpos-trade";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/debts")({
  component: Debts,
});

function Debts() {
  const { org, user } = useAuth();
  const { data: sales, refresh: refreshSales } = useLive<Sale[]>(org?.id, ["sales"], listSales, []);
  const { data: payments, refresh: refreshPayments } = useLive<CustomerPayment[]>(
    org?.id, ["customer_payments"], listCustomerPayments, [],
  );
  const [paying, setPaying] = useState<DebtRow | null>(null);

  if (!org || !user) return null;
  const debts = buildDebts(sales, payments).filter((d) => d.balance > 0);
  const totalOwed = debts.reduce((a, d) => a + d.balance, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Debts · Madeni</h1>
        <p className="text-sm text-muted-foreground">
          {debts.length} debtor{debts.length === 1 ? "" : "s"} · {fmtMoney(totalOwed, org.currency)} outstanding
        </p>
      </div>

      <div className="panel clip-cut-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="p-3">Customer</th>
                <th className="p-3">Since</th>
                <th className="p-3 text-right">Billed</th>
                <th className="p-3 text-right">Paid</th>
                <th className="p-3 text-right">Balance</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {debts.map((d) => (
                <tr key={d.key} className="border-b border-border last:border-0">
                  <td className="p-3 font-semibold">{d.customerName}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(d.oldest).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">{fmtMoney(d.billed, org.currency)}</td>
                  <td className="p-3 text-right text-muted-foreground">
                    {fmtMoney(d.paid, org.currency)}
                  </td>
                  <td className="p-3 text-right font-bold text-gold">
                    {fmtMoney(d.balance, org.currency)}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setPaying(d)}
                      className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest hover:border-[color:var(--gold)]/60"
                    >
                      <HandCoins className="h-3.5 w-3.5" /> Receive
                    </button>
                  </td>
                </tr>
              ))}
              {debts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No outstanding debts. 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {paying && (
        <PayModal
          debt={paying}
          onClose={() => { setPaying(null); void refreshSales(); void refreshPayments(); }}
        />
      )}
    </div>
  );
}

function PayModal({ debt, onClose }: { debt: DebtRow; onClose: () => void }) {
  const { org, user } = useAuth();
  const [amount, setAmount] = useState(String(debt.balance));
  const [method, setMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  if (!org || !user) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!(amt > 0)) return toast.error("Enter an amount");
    setBusy(true);
    try {
      await addCustomerPayment(org.id, user.id, {
        customerId: debt.customerId,
        saleId: debt.sales[0]?.id,
        amount: amt,
        method,
        note: "repayment",
      });
      toast.success(`Received ${fmtMoney(amt, org.currency)}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/60 p-4">
      <form onSubmit={save} className="panel clip-cut-card w-full max-w-sm space-y-4 p-6">
        <h3 className="font-display text-lg font-bold uppercase tracking-widest text-gold">
          Receive payment
        </h3>
        <p className="-mt-2 text-sm text-muted-foreground">
          {debt.customerName} owes {fmtMoney(debt.balance, org.currency)}
        </p>
        <input
          type="number" step="any" min={0} value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-none border border-border bg-input px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-3 gap-2">
          {["cash", "mobile", "bank"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`rounded-none border py-2 text-[11px] font-bold uppercase tracking-widest ${
                method === m
                  ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-gold"
                  : "border-border text-muted-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <GoldButton type="submit" className="flex-1" disabled={busy}>
            {busy ? "Saving…" : "Record"}
          </GoldButton>
          <GoldButton type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </GoldButton>
        </div>
      </form>
    </div>
  );
}
