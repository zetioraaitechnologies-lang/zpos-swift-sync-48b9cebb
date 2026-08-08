import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Minus, Trash2, Receipt, Printer, UserPlus, User as UserIcon, X, WifiOff } from "lucide-react";
import {
  fmtMoney,
  useLive,
  listProducts,
  listCustomers,
  getSale,
  upsertCustomer,
  type Product,
  type Customer,
  type Sale,
} from "@/lib/zpos-data";
import { safeRecordSale, isOnline, pendingCount, subscribeSyncStatus } from "@/lib/zpos-offline";
import { isWeighed, qtyStep, roundQty, fmtQty, PORTIONS } from "@/lib/weighing";
import { listVariants, variantLabel, type ProductVariant } from "@/lib/zpos-trade";
import { useAuth } from "@/lib/zpos-auth";
import { GoldButton } from "@/components/zpos/gold-button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pos")({
  component: POS,
});

interface CartLine {
  productId: string;
  variantId?: string;
  qty: number;
}

const lineKey = (productId: string, variantId?: string) =>
  `${productId}:${variantId ?? ""}`;

interface AttachedCustomer {
  id?: string;
  name: string;
  phone?: string;
}

function POS() {
  const { org, user } = useAuth();
  const { data: products } = useLive<Product[]>(org?.id, ["products"], listProducts, []);
  const { data: variants } = useLive<ProductVariant[]>(
    org?.id,
    ["product_variants"],
    listVariants,
    [],
  );

  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [picking, setPicking] = useState<Product | null>(null);
  const [discount, setDiscount] = useState(0);
  const [pay, setPay] = useState<"cash" | "mobile" | "bank" | "credit">("cash");
  const [deposit, setDeposit] = useState("");
  const [showReceipt, setShowReceipt] = useState<null | string>(null);
  const [customer, setCustomer] = useState<AttachedCustomer | null>(null);
  const [showCustomer, setShowCustomer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(pendingCount());

  useEffect(() => {
    const onNet = () => setOnline(isOnline());
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
    const unsub = subscribeSyncStatus((s) => setPending(s.pending));
    return () => {
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
      unsub();
    };
  }, []);

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          (p.barcode ?? "").includes(q),
      ),
    [products, q],
  );

  if (!org || !user) return null;

  const lines = cart
    .map((c) => {
      const p = products.find((x) => x.id === c.productId);
      if (!p) return null;
      const v = c.variantId ? variants.find((x) => x.id === c.variantId) : undefined;
      const price = v?.price ?? p.price;
      const cost = v?.costPrice ?? p.costPrice;
      const name = v ? `${p.name} (${variantLabel(v)})` : p.name;
      return { key: lineKey(c.productId, c.variantId), p, v, qty: c.qty, price, cost, name };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  const total = Math.max(0, subtotal - discount);

  const add = (p: Product, amount?: number, variant?: ProductVariant) => {
    const step = amount ?? qtyStep(p);
    const vid = variant?.id;
    setCart((c) => {
      const ex = c.find((x) => x.productId === p.id && x.variantId === vid);
      if (ex)
        return c.map((x) =>
          x.productId === p.id && x.variantId === vid
            ? { ...x, qty: roundQty(x.qty + step) }
            : x,
        );
      return [...c, { productId: p.id, variantId: vid, qty: step }];
    });
  };

  const pick = (p: Product) => {
    const opts = variants.filter((v) => v.productId === p.id);
    if (opts.length) setPicking(p);
    else add(p);
  };

  const setQty = (key: string, qty: number) =>
    setCart((c) =>
      qty <= 0
        ? c.filter((x) => lineKey(x.productId, x.variantId) !== key)
        : c.map((x) =>
            lineKey(x.productId, x.variantId) === key ? { ...x, qty: roundQty(qty) } : x,
          ),
    );


  const complete = async () => {
    if (!lines.length) return;
    setBusy(true);
    try {
      const saleId = await safeRecordSale(org.id, {
        items: lines.map((l) => ({
          productId: l.p.id,
          variantId: l.v?.id,
          name: l.name,
          qty: l.qty,
          price: l.price,
          cost: l.cost,
        })),
        discount,
        payment: pay,
        customerId: customer?.id,
        customerName: customer?.name,
        amountPaid: pay === "credit" ? Number(deposit) || 0 : undefined,
      });
      if (isOnline()) {
        toast.success(`Sale completed · ${fmtMoney(total, org.currency)}`);
      } else {
        toast.success(`Sale saved offline · ${fmtMoney(total, org.currency)}`, {
          description: "It will sync automatically when you are back online.",
          duration: 4000,
        });
      }
      setShowReceipt(saleId);
      setCart([]);
      setDiscount(0);
      setDeposit("");
      setCustomer(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sale failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="flex min-h-0 flex-col">
        <div className="mb-4">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Point of Sale
          </h1>
          <p className="text-sm text-muted-foreground">
            Fast checkout · synced across every device
          </p>
        </div>

        {!online && (
          <div className="mb-4 flex items-center gap-2 border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-amber-600">
            <WifiOff className="h-3.5 w-3.5" />
            Offline mode — sales are queued and will sync when connection returns
          </div>
        )}
        {online && pending > 0 && (
          <div className="mb-4 flex items-center gap-2 border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--gold)]">
            {pending} sale{pending > 1 ? "s" : ""} waiting to sync…
          </div>
        )}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search product or scan barcode…"
            className="w-full rounded-none border border-border bg-input py-3 pl-10 pr-3 text-sm outline-none focus:border-[color:var(--gold)]/60"
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
                  {p.category} · {fmtQty(p.stock, p.unit)} in stock
                </div>
                <div className="mt-3 font-display text-lg font-bold text-gold">
                  {fmtMoney(p.price, org.currency)}
                  {isWeighed(p) && (
                    <span className="ml-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      / {p.unit ?? "kg"}
                    </span>
                  )}
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

      <div className="panel clip-cut-card flex max-h-[calc(100vh-8rem)] flex-col p-5 lg:sticky lg:top-24">
        <h3 className="font-display font-bold uppercase tracking-widest text-gold">
          Cart · {lines.length}
        </h3>

        <div className="mt-3 rounded-none border border-border bg-secondary p-2">
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
          {lines.map((l) => {
            const weighed = isWeighed(l.p);
            const step = qtyStep(l.p);
            return (
            <div
              key={l.p.id}
              className="rounded-none border border-border bg-secondary p-2"
            >
              <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{l.p.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {fmtMoney(l.p.price, org.currency)}
                  {l.p.unit ? ` / ${l.p.unit}` : ""} ·{" "}
                  <span className="font-bold text-foreground">
                    {fmtMoney(l.p.price * l.qty, org.currency)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setQty(l.p.id, l.qty - step)}
                  className="grid h-7 w-7 place-items-center rounded-none border border-border hover:bg-secondary"
                >
                  <Minus className="h-3 w-3" />
                </button>
                {weighed ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.05}
                    value={l.qty}
                    onChange={(e) => setQty(l.p.id, Number(e.target.value) || 0)}
                    className="w-16 rounded-none border border-border bg-input px-1 py-1 text-center text-sm font-bold outline-none focus:border-[color:var(--gold)]/60"
                  />
                ) : (
                  <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
                )}
                <button
                  onClick={() => setQty(l.p.id, l.qty + step)}
                  className="grid h-7 w-7 place-items-center rounded-none border border-border hover:bg-secondary"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setQty(l.p.id, 0)}
                  className="ml-1 grid h-7 w-7 place-items-center rounded-none text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              </div>
              {weighed && (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {l.p.unit ?? "kg"}
                  </span>
                  {PORTIONS.map((pt) => (
                    <button
                      key={pt.value}
                      onClick={() => setQty(l.p.id, pt.value)}
                      className={`rounded-none border px-2 py-0.5 text-[11px] font-bold ${
                        l.qty === pt.value
                          ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-gold"
                          : "border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>

        <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <Row label="Subtotal" value={fmtMoney(subtotal, org.currency)} />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Discount</span>
            <input
              type="number"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
              className="w-28 rounded-none border border-border bg-input px-2 py-1 text-right text-sm outline-none focus:border-[color:var(--gold)]/60"
            />
          </div>
          <Row label="Total" value={fmtMoney(total, org.currency)} big />

          <div className="mt-3 grid grid-cols-4 gap-2">
            {(["cash", "mobile", "bank", "credit"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPay(m)}
                className={`rounded-none border py-2 text-[11px] font-bold uppercase tracking-widest ${
                  pay === m
                    ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-gold"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {pay === "credit" && (
            <div className="mt-3 space-y-2 border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/5 p-2">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gold">
                Credit sale · deni
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Paid now</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  placeholder="0"
                  className="w-28 rounded-none border border-border bg-input px-2 py-1 text-right text-sm outline-none"
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Balance owed</span>
                <span className="font-bold text-gold">
                  {fmtMoney(Math.max(0, total - (Number(deposit) || 0)), org.currency)}
                </span>
              </div>
              {!customer && (
                <div className="text-[11px] text-amber-500">
                  Attach a customer so the debt can be tracked.
                </div>
              )}
            </div>
          )}

          <GoldButton
            onClick={complete}
            size="lg"
            className="mt-4 w-full"
            disabled={!lines.length || busy || (pay === "credit" && !customer)}
          >
            <Receipt className="h-4 w-4" /> {busy ? "Processing…" : "Complete Sale"}
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
  const { data: customers } = useLive<Customer[]>(org?.id, ["customers"], listCustomers, []);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  if (!org) return null;
  const list = customers.filter(
    (c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q),
  );

  const quickCreate = async () => {
    if (!name.trim()) return toast.error("Customer name is required");
    setBusy(true);
    try {
      const id = await upsertCustomer(org.id, { name: name.trim(), phone: phone.trim() });
      toast.success("Customer added");
      onPick({ id, name: name.trim(), phone: phone.trim() });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/60 p-4">
      <div className="panel clip-cut-card w-full max-w-md space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold uppercase tracking-widest text-gold">
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
            className="w-full rounded-none border border-border bg-input px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => onPick({ id: c.id, name: c.name, phone: c.phone })}
                className="flex w-full items-center justify-between rounded-none border border-border bg-secondary px-3 py-2 text-left text-sm hover:border-[color:var(--gold)]/40"
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

        <div className="border-t border-border pt-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Or add a new one
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="rounded-none border border-border bg-input px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="rounded-none border border-border bg-input px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <GoldButton onClick={quickCreate} className="flex-1" disabled={busy}>
              {busy ? "Saving…" : "Save & Attach"}
            </GoldButton>
            <button
              type="button"
              onClick={() => onPick({ name: name.trim() || "Walk-in", phone: phone.trim() || undefined })}
              className="flex-1 rounded-none border border-border py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:bg-secondary"
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
      <span className={big ? "font-display text-xl font-bold text-gold" : "font-semibold"}>
        {value}
      </span>
    </div>
  );
}

function ReceiptModal({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const { org } = useAuth();
  const [sale, setSale] = useState<Sale | null>(null);
  useMemo(() => { void getSale(saleId).then(setSale); }, [saleId]);
  if (!sale || !org) return null;

  const print = () => window.print();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/50 p-4 print:static print:bg-transparent print:p-0">
      <div
        id="receipt-print-area"
        className="panel clip-cut-card w-full max-w-sm p-6 print:!bg-white print:!text-on-accent print:!shadow-none print:!border-0"
      >
        <div className="text-center">
          {org.logo && (
            <img src={org.logo} alt="" className="mx-auto mb-2 h-14 w-14 rounded-none object-cover" />
          )}
          {org.receiptHeader && (
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground print:!text-gray-800">
              {org.receiptHeader}
            </div>
          )}
          <div className="font-display text-xl font-bold tracking-tight text-gold print:!text-on-accent">
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
        <div className="my-4 border-t border-dashed border-border print:!border-gray-400" />
        <div className="space-y-1 text-sm">
          {sale.items.map((i) => (
            <div key={i.productId + i.name} className="flex justify-between">
              <span>
                {fmtQty(i.qty)} × {i.name}
              </span>
              <span>{fmtMoney(i.qty * i.price, org.currency)}</span>
            </div>
          ))}
        </div>
        <div className="my-4 border-t border-dashed border-border print:!border-gray-400" />
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
          <div className="flex justify-between font-display text-lg font-bold text-gold print:!text-on-accent">
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
