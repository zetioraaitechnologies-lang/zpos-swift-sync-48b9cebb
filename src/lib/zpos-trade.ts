// Suppliers & purchases, credit sales (madeni) and product variants.
//
// Same Supabase-backed, org-scoped pattern as `zpos-data.ts`.

import { supabase } from "@/integrations/supabase/client";
import type { Sale } from "@/lib/zpos-data";

type Row = Record<string, unknown>;
const num = (v: unknown, d = 0) => (v == null ? d : Number(v));
const str = (v: unknown, d = "") => (v == null ? d : String(v));
const ts = (v: unknown) => (v ? new Date(v as string).getTime() : Date.now());

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface Supplier {
  id: string;
  orgId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
  createdAt: number;
}

export interface PurchaseItem {
  productId?: string;
  name: string;
  qty: number;
  cost: number;
}

export interface Purchase {
  id: string;
  orgId: string;
  supplierId?: string;
  supplierName?: string;
  total: number;
  note?: string;
  items: PurchaseItem[];
  createdAt: number;
}

export interface CustomerPayment {
  id: string;
  orgId: string;
  customerId?: string;
  saleId?: string;
  amount: number;
  method: string;
  note?: string;
  createdAt: number;
}

export interface ProductVariant {
  id: string;
  orgId: string;
  productId: string;
  size?: string;
  color?: string;
  barcode?: string;
  price?: number;
  costPrice?: number;
  stock: number;
}

export function variantLabel(v: Pick<ProductVariant, "size" | "color">): string {
  return [v.size, v.color].filter(Boolean).join(" · ") || "Default";
}

// ------------------------------------------------------------------
// Suppliers
// ------------------------------------------------------------------

function mapSupplier(r: Row): Supplier {
  return {
    id: str(r.id),
    orgId: str(r.org_id),
    name: str(r.name),
    phone: (r.phone as string) || undefined,
    email: (r.email as string) || undefined,
    address: (r.address as string) || undefined,
    note: (r.note as string) || undefined,
    createdAt: ts(r.created_at),
  };
}

export async function listSuppliers(orgId: string): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => mapSupplier(r as Row));
}

export async function upsertSupplier(
  orgId: string,
  input: { name: string; phone?: string; email?: string; address?: string; note?: string },
  id?: string,
): Promise<string> {
  const payload = {
    org_id: orgId,
    name: input.name,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
    note: input.note || null,
  };
  if (id) {
    const { error } = await supabase.from("suppliers").update(payload).eq("id", id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase
    .from("suppliers")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

export async function deleteSupplier(id: string) {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
}

// ------------------------------------------------------------------
// Purchases (goods received — raises stock)
// ------------------------------------------------------------------

export async function listPurchases(orgId: string, limit = 200): Promise<Purchase[]> {
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  if (!rows.length) return [];
  const { data: itemRows } = await supabase
    .from("purchase_items")
    .select("*")
    .in("purchase_id", rows.map((r) => String(r.id)));
  const byId = new Map<string, Row[]>();
  ((itemRows ?? []) as Row[]).forEach((i) => {
    const k = String(i.purchase_id);
    byId.set(k, [...(byId.get(k) ?? []), i]);
  });
  return rows.map((r) => ({
    id: str(r.id),
    orgId: str(r.org_id),
    supplierId: (r.supplier_id as string) || undefined,
    supplierName: (r.supplier_name as string) || undefined,
    total: num(r.total),
    note: (r.note as string) || undefined,
    createdAt: ts(r.created_at),
    items: (byId.get(str(r.id)) ?? []).map((i) => ({
      productId: (i.product_id as string) || undefined,
      name: str(i.name),
      qty: num(i.qty),
      cost: num(i.cost),
    })),
  }));
}

export async function recordPurchase(
  orgId: string,
  input: { items: PurchaseItem[]; supplierId?: string; supplierName?: string; note?: string },
): Promise<string> {
  const { data, error } = await supabase.rpc("record_purchase", {
    _org_id: orgId,
    _items: input.items.map((i) => ({
      product_id: i.productId ?? null,
      name: i.name,
      qty: i.qty,
      cost: i.cost,
    })),
    _supplier_id: input.supplierId ?? undefined,
    _supplier_name: input.supplierName ?? undefined,
    _note: input.note ?? undefined,
  } as never);
  if (error) throw error;
  return String(data);
}

// ------------------------------------------------------------------
// Credit sales / debtors (madeni)
// ------------------------------------------------------------------

export async function listCustomerPayments(orgId: string): Promise<CustomerPayment[]> {
  const { data, error } = await supabase
    .from("customer_payments")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as Row;
    return {
      id: str(row.id),
      orgId: str(row.org_id),
      customerId: (row.customer_id as string) || undefined,
      saleId: (row.sale_id as string) || undefined,
      amount: num(row.amount),
      method: str(row.method, "cash"),
      note: (row.note as string) || undefined,
      createdAt: ts(row.created_at),
    };
  });
}

export async function addCustomerPayment(
  orgId: string,
  userId: string,
  input: { customerId?: string; saleId?: string; amount: number; method?: string; note?: string },
) {
  const { error } = await supabase.from("customer_payments").insert({
    org_id: orgId,
    user_id: userId,
    customer_id: input.customerId ?? null,
    sale_id: input.saleId ?? null,
    amount: input.amount,
    method: input.method || "cash",
    note: input.note || null,
  });
  if (error) throw error;
}

export interface DebtRow {
  key: string;
  customerId?: string;
  customerName: string;
  sales: Sale[];
  billed: number;
  paid: number;
  balance: number;
  oldest: number;
}

/** Groups unpaid credit sales per customer, applying extra repayments. */
export function buildDebts(sales: Sale[], payments: CustomerPayment[]): DebtRow[] {
  const credit = sales.filter((s) => s.payment === "credit");
  const map = new Map<string, DebtRow>();
  for (const s of credit) {
    const key = s.customerId ?? `name:${s.customerName ?? "Walk-in"}`;
    const row =
      map.get(key) ??
      {
        key,
        customerId: s.customerId,
        customerName: s.customerName || "Walk-in",
        sales: [],
        billed: 0,
        paid: 0,
        balance: 0,
        oldest: s.createdAt,
      };
    row.sales.push(s);
    row.billed += s.total;
    row.paid += s.amountPaid;
    row.oldest = Math.min(row.oldest, s.createdAt);
    map.set(key, row);
  }
  // Repayments recorded after the sale (not the deposit rows already counted
  // in amount_paid) are matched to the customer.
  for (const p of payments) {
    if (p.note === "deposit at sale") continue;
    const key = p.customerId ? p.customerId : undefined;
    if (!key) continue;
    const row = map.get(key);
    if (row) row.paid += p.amount;
  }
  return [...map.values()]
    .map((r) => ({ ...r, balance: Math.max(0, r.billed - r.paid) }))
    .sort((a, b) => b.balance - a.balance);
}

// ------------------------------------------------------------------
// Product variants (size / colour)
// ------------------------------------------------------------------

function mapVariant(r: Row): ProductVariant {
  return {
    id: str(r.id),
    orgId: str(r.org_id),
    productId: str(r.product_id),
    size: (r.size as string) || undefined,
    color: (r.color as string) || undefined,
    barcode: (r.barcode as string) || undefined,
    price: r.price == null ? undefined : num(r.price),
    costPrice: r.cost_price == null ? undefined : num(r.cost_price),
    stock: num(r.stock),
  };
}

export async function listVariants(orgId: string): Promise<ProductVariant[]> {
  const { data, error } = await supabase
    .from("product_variants")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((r) => mapVariant(r as Row));
}

export async function upsertVariant(
  orgId: string,
  productId: string,
  input: {
    size?: string;
    color?: string;
    barcode?: string;
    price?: number;
    costPrice?: number;
    stock: number;
  },
  id?: string,
) {
  const payload = {
    org_id: orgId,
    product_id: productId,
    size: input.size || null,
    color: input.color || null,
    barcode: input.barcode || null,
    price: input.price ?? null,
    cost_price: input.costPrice ?? null,
    stock: input.stock,
  };
  if (id) {
    const { error } = await supabase.from("product_variants").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("product_variants").insert(payload);
    if (error) throw error;
  }
}

export async function deleteVariant(id: string) {
  const { error } = await supabase.from("product_variants").delete().eq("id", id);
  if (error) throw error;
}
