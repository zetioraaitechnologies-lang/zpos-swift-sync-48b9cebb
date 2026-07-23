import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Minus, Trash2, Receipt, Printer, UserPlus, User as UserIcon, X } from "lucide-react";
import { zdb, fmtMoney, uid, type Product } from "@/lib/zpos-db";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pos")({
  component: POS,
});

interface CartLine {
  productId: string;
  qty: number;
}

interface AttachedCustomer {
  id?: string; // present if from DB
  name: string;
  phone?: string;
}

function POS() {
  const { org, user } = useAuth();
  const [, setV] = useState(0);
  useEffect(() => {
    const u = zdb.subscribe(() => setV((n) => n + 1));
    return () => {
      u();
    };
  }, []);

  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [pay, setPay] = useState<"cash" | "mobile" | "bank">("cash");
  const [showReceipt, setShowReceipt] = useState<null | string>(null);
  const [customer, setCustomer] = useState<AttachedCustomer | null>(null);
  const [showCustomer, setShowCustomer] = useState(false);

  if (!org || !user) return null;
  const db = zdb.get();
  const products = db.products.filter((p) => p.orgId === org.id);
  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          (p.barcode ?? "").includes(q),
      ),
    [products, q],
  );

  const lines = cart
    .map((c) => {
      const p = products.find((x) => x.id === c.productId);
      return p ? { p, qty: c.qty } : null;
    })
    .filter((x): x is { p: Product; qty: number } => !!x);

  const subtotal = lines.reduce((a, l) => a + l.p.price * l.qty, 0);
  const total = Math.max(0, subtotal - discount);

  const add = (p: Product) => {
    setCart((c) => {
      const ex = c.find((x) => x.productId === p.id);
      if (ex) return c.map((x) => (x.productId === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { productId: p.id, qty: 1 }];
    });
  };
  const setQty = (pid: string, qty: number) =>
    setCart((c) =>
      qty <= 0 ? c.filter((x) => x.productId !== pid) : c.map((x) => (x.productId === pid ? { ...x, qty } : x)),
    );

  const complete = () => {
    if (!lines.length) return;
    const saleId = uid("sale");
    const profit = lines.reduce((a, l) => a + (l.p.price - l.p.costPrice) * l.qty, 0);
    zdb.update((d) => {
      d.sales.push({
        id: saleId,
        orgId: org.id,
        items: lines.map((l) => ({
          productId: l.p.id,
          name: l.p.name,
          qty: l.qty,
          price: l.p.price,
          cost: l.p.costPrice,
        })),
        subtotal,
        discount,
        total,
        profit: profit - discount,
        payment: pay,
        customerId: customer?.id,
        customerName: customer?.name,
        cashierId: user.id,
        createdAt: Date.now(),
      });
      lines.forEach((l) => {
        const prod = d.products.find((x) => x.id === l.p.id);
        if (prod) {
          const before = prod.stock;
          prod.stock = Math.max(0, prod.stock - l.qty);
          d.stockMovements.push({
            id: uid("mv"),
            orgId: org.id,
            productId: prod.id,
            productName: prod.name,
            type: "sale",
            qty: -l.qty,
            before,
            after: prod.stock,
            userId: user.id,
            note: `Sale ${saleId}`,
            createdAt: Date.now(),
          });
        }
      });
    });
    toast.success(`Sale completed · ${fmtMoney(total, org.currency)}`);
    setShowReceipt(saleId);
    setCart([]);
    setDiscount(0);
    setCustomer(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="flex min-h-0 flex-col">
        <div className="mb-4">
          <h1 className="font-display text-3xl font-black uppercase tracking-wider">
            Point of Sale
          </h1>
          <p className="text-sm text-muted-foreground">
            Fast checkout · offline-ready
          </p>
        </div>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search product or scan barcode…"
            className="w-full rounded-md border border-white/10 bg-black/40 py-3 pl-10 pr-3 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
        </div>
        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => add(p)}
                disabled={p.stock <= 0}
                className="panel clip-cut-card p-4 text-left transition hover:scale-[1.02] disabled:opacity-40"
              >
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {p.category} · {p.stock}{p.unit ? ` ${p.unit}` : ""} in stock
                </div>
                <div className="mt-3 font-display text-lg font-black text-gold">
                  {fmtMoney(p.price, org.currency)}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                No products match "{q}".
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart */}
      <div className="panel clip-cut-card flex max-h-[calc(100vh-8rem)] flex-col p-5 lg:sticky lg:top-24">
        <h3 className="font-display font-bold uppercase tracking-widest text-gold">
          Cart · {lines.length}
        </h3>

        {/* Customer attach */}
        <div className="mt-3 rounded-md border border-white/10 bg-black/30 p-2">
          {customer ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <UserIcon className="h-3.5 w-3.5 text-gold" />
                <div>
                  <div className="font-semibold">{customer.name}</div>
                  {customer.phone && (
                    <div className="text-[11px] text-muted-foreground">{customer.phone}</div>
                  )}
                </div>
              </div>
              <button onClick={() => setCustomer(null)} className="text-muted-foreground hover:text-red-300">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomer(true)}
              className="flex w-full items-center justify-center gap-2 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-gold"
            >
              <UserPlus className="h-3.5 w-3.5" /> Attach customer (optional)
            </button>
          )}
        </div>

        <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
          {lines.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Cart is empty
            </div>
          )}
          {lines.map((l) => (
            <div
              key={l.p.id}
              className="flex items-center gap-2 rounded-md border border-white/5 bg-black/30 p-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{l.p.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {fmtMoney(l.p.price, org.currency)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setQty(l.p.id, l.qty - 1)}
                  className="grid h-7 w-7 place-items-center rounded border border-white/10 hover:bg-white/5"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
                <button
                  onClick={() => setQty(l.p.id, l.qty + 1)}
                  className="grid h-7 w-7 place-items-center rounded border border-white/10 hover:bg-white/5"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setQty(l.p.id, 0)}
                  className="ml-1 grid h-7 w-7 place-items-center rounded text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
          <Row label="Subtotal" value={fmtMoney(subtotal, org.currency)} />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Discount</span>
            <input
              type="number"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
              className="w-28 rounded border border-white/10 bg-black/40 px-2 py-1 text-right text-sm outline-none focus:border-[color:var(--gold)]/60"
            />
          </div>
          <Row label="Total" value={fmtMoney(total, org.currency)} big />

          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["cash", "mobile", "bank"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPay(m)}
                className={`rounded-md border py-2 text-[11px] font-bold uppercase tracking-widest ${
                  pay === m
                    ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-gold"
                    : "border-white/10 text-muted-foreground hover:bg-white/5"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <GoldButton
            onClick={complete}
            size="lg"
            className="mt-4 w-full"
            disabled={!lines.length}
          >
            <Receipt className="h-4 w-4" /> Complete Sale
          </GoldButton>
        </div>
      </div>

      {showReceipt && (
        <ReceiptModal saleId={showReceipt} onClose={() => setShowReceipt(null)} />
      )}
      {showCustomer && (
        <CustomerPicker
          onClose={() => setShowCustomer(false)}
          onPick={(c) => { setCustomer(c); setShowCustomer(false); }}
        />
      )}
    </div>
  );
}

function CustomerPicker({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (c: AttachedCustomer) => void;
}) {
  const { org } = useAuth();
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  if (!org) return null;
  const list = zdb
    .get()
    .customers.filter((c) => c.orgId === org.id)
    .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q));

  const quickCreate = () => {
    if (!name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    const id = uid("c");
    zdb.update((d) => {
      d.customers.push({
        id,
        orgId: org.id,
        name: name.trim(),
        phone: phone.trim(),
        createdAt: Date.now(),
      });
    });
    toast.success("Customer added");
    onPick({ id, name: name.trim(), phone: phone.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="panel clip-cut-card w-full max-w-md space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-black uppercase tracking-widest text-gold">
            Attach Customer
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search saved customers…"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => onPick({ id: c.id, name: c.name, phone: c.phone })}
                className="flex w-full items-center justify-between rounded-md border border-white/5 bg-black/20 px-3 py-2 text-left text-sm hover:border-[color:var(--gold)]/40"
              >
                <span className="font-semibold">{c.name}</span>
                <span className="text-[11px] text-muted-foreground">{c.phone}</span>
              </button>
            ))}
            {list.length === 0 && (
              <div className="py-3 text-center text-xs text-muted-foreground">
                No matches
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 pt-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Or add a new one
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <GoldButton onClick={quickCreate} className="flex-1">
              Save & Attach
            </GoldButton>
            <button
              type="button"
              onClick={() => onPick({ name: name.trim() || "Walk-in", phone: phone.trim() || undefined })}
              className="flex-1 rounded-md border border-white/10 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:bg-white/5"
            >
              Use without saving
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={big ? "font-display text-xl font-black text-gold" : "font-semibold"}>
        {value}
      </span>
    </div>
  );
}

function ReceiptModal({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const { org } = useAuth();
  const sale = zdb.get().sales.find((s) => s.id === saleId);
  if (!sale || !org) return null;

  const print = () => window.print();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 print:static print:bg-transparent print:p-0">
      <div
        id="receipt-print-area"
        className="panel clip-cut-card w-full max-w-sm p-6 print:!bg-white print:!text-black print:!shadow-none print:!border-0"
      >
        <div className="text-center">
          {org.logo && (
            <img src={org.logo} alt="" className="mx-auto mb-2 h-14 w-14 rounded-md object-cover" />
          )}
          {org.receiptHeader && (
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground print:!text-gray-800">
              {org.receiptHeader}
            </div>
          )}
          <div className="font-display text-xl font-black uppercase tracking-widest text-gold print:!text-black">
            {org.businessName}
          </div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground print:!text-gray-700">
            {org.address}
          </div>
          {(org.tin || org.vatNumber) && (
            <div className="mt-1 text-[10px] text-muted-foreground print:!text-gray-700">
              {org.tin && <>TIN: {org.tin}</>}
              {org.tin && org.vatNumber && " · "}
              {org.vatNumber && <>VAT: {org.vatNumber}</>}
            </div>
          )}
          <div className="mt-1 text-xs text-muted-foreground print:!text-gray-700">
            {new Date(sale.createdAt).toLocaleString()}
          </div>
          {sale.customerName && (
            <div className="mt-1 text-xs text-muted-foreground print:!text-gray-700">
              Customer: {sale.customerName}
            </div>
          )}
        </div>
        <div className="my-4 border-t border-dashed border-white/20 print:!border-gray-400" />
        <div className="space-y-1 text-sm">
          {sale.items.map((i) => (
            <div key={i.productId} className="flex justify-between">
              <span>
                {i.qty} × {i.name}
              </span>
              <span>{fmtMoney(i.qty * i.price, org.currency)}</span>
            </div>
          ))}
        </div>
        <div className="my-4 border-t border-dashed border-white/20 print:!border-gray-400" />
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{fmtMoney(sale.subtotal, org.currency)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{fmtMoney(sale.discount, org.currency)}</span>
            </div>
          )}
          {org.vatRate && org.vatRate > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground print:!text-gray-700">
              <span>VAT {org.vatRate}% (incl.)</span>
              <span>{fmtMoney((sale.total * org.vatRate) / (100 + org.vatRate), org.currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-display text-lg font-black text-gold print:!text-black">
            <span>TOTAL</span>
            <span>{fmtMoney(sale.total, org.currency)}</span>
          </div>
          <div className="flex justify-between text-xs uppercase tracking-widest text-muted-foreground print:!text-gray-700">
            <span>Payment</span>
            <span>{sale.payment}</span>
          </div>
        </div>
        <div className="mt-6 text-center text-[11px] italic text-muted-foreground print:!text-gray-700">
          {org.receiptFooter ?? "Thank you for your business!"}
        </div>
        {org.website && (
          <div className="mt-1 text-center text-[10px] text-muted-foreground print:!text-gray-700">
            {org.website}
          </div>
        )}
        <div className="mt-6 flex gap-2 print:hidden">
          <GoldButton onClick={print} size="sm" className="flex-1">
            <Printer className="h-3.5 w-3.5" /> Print
          </GoldButton>
          <GoldButton
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onClose}
          >
            Close
          </GoldButton>
        </div>
      </div>
    </div>
  );
}
