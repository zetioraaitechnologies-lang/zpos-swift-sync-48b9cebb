// Supabase-backed data layer for ZPOS.
//
// Every entity is stored per-organization in Postgres and read live via a
// single `useLive` hook: it fetches on mount / org change, and re-fetches
// whenever a realtime change hits the org's rows. No local blob, no
// per-device drift — every tab and every device sees the same numbers.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ------------------------------------------------------------------
// Types (kept close to the shapes the screens already use).
// ------------------------------------------------------------------

export interface Organization {
  id: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  status: "active" | "suspended";
  createdAt: number;
  currency: string;
  logo?: string;
  receiptFooter?: string;
  tin?: string;
  vatNumber?: string;
  vatRate?: number;
  website?: string;
  receiptHeader?: string;
}

export interface Product {
  id: string;
  orgId: string;
  name: string;
  category: string;
  barcode?: string;
  costPrice: number;
  price: number;
  stock: number;
  minStock: number;
  unit?: string;
  image?: string;
  description?: string;
  updatedAt: number;
}

export interface Customer {
  id: string;
  orgId: string;
  name: string;
  phone: string;
  address?: string;
  createdAt: number;
}

export interface SaleItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  cost: number;
}

export interface Sale {
  id: string;
  orgId: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  profit: number;
  payment: "cash" | "mobile" | "bank";
  customerId?: string;
  customerName?: string;
  cashierId: string;
  createdAt: number;
}

export interface Expense {
  id: string;
  orgId: string;
  category: "Rent" | "Salaries" | "Electricity" | "Transport" | "Others";
  amount: number;
  note?: string;
  createdAt: number;
}

export interface StockMovement {
  id: string;
  orgId: string;
  productId: string;
  productName: string;
  type: "in" | "out" | "adjust" | "sale";
  qty: number;
  before: number;
  after: number;
  userId: string;
  note?: string;
  createdAt: number;
}

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------

export function fmtMoney(n: number, currency = "TZS") {
  return `${currency} ${Math.round(n).toLocaleString()}`;
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// ------------------------------------------------------------------
// Row mappers (snake_case DB → camelCase app)
// ------------------------------------------------------------------

type Row = Record<string, unknown>;
const num = (v: unknown, d = 0) => (v == null ? d : Number(v));
const str = (v: unknown, d = "") => (v == null ? d : String(v));
const ts = (v: unknown) => (v ? new Date(v as string).getTime() : Date.now());

function mapProduct(r: Row): Product {
  return {
    id: str(r.id),
    orgId: str(r.org_id),
    name: str(r.name),
    category: str(r.category, "General"),
    barcode: (r.barcode as string) || undefined,
    costPrice: num(r.cost_price),
    price: num(r.price),
    stock: num(r.stock),
    minStock: num(r.min_stock),
    unit: (r.unit as string) || undefined,
    image: (r.image as string) || undefined,
    description: (r.description as string) || undefined,
    updatedAt: ts(r.updated_at),
  };
}

function mapCustomer(r: Row): Customer {
  return {
    id: str(r.id),
    orgId: str(r.org_id),
    name: str(r.name),
    phone: str(r.phone),
    address: (r.address as string) || undefined,
    createdAt: ts(r.created_at),
  };
}

function mapExpense(r: Row): Expense {
  return {
    id: str(r.id),
    orgId: str(r.org_id),
    category: (str(r.category, "Others") as Expense["category"]),
    amount: num(r.amount),
    note: (r.note as string) || undefined,
    createdAt: ts(r.created_at),
  };
}

function mapMovement(r: Row): StockMovement {
  return {
    id: str(r.id),
    orgId: str(r.org_id),
    productId: str(r.product_id),
    productName: str(r.product_name),
    type: (str(r.type, "adjust") as StockMovement["type"]),
    qty: num(r.qty),
    before: num(r.before_qty),
    after: num(r.after_qty),
    userId: str(r.user_id),
    note: (r.note as string) || undefined,
    createdAt: ts(r.created_at),
  };
}

function mapSale(r: Row, items: Row[] = []): Sale {
  return {
    id: str(r.id),
    orgId: str(r.org_id),
    items: items.map((i) => ({
      productId: str(i.product_id),
      name: str(i.name),
      qty: num(i.qty),
      price: num(i.price),
      cost: num(i.cost),
    })),
    subtotal: num(r.subtotal),
    discount: num(r.discount),
    total: num(r.total),
    profit: num(r.profit),
    payment: (str(r.payment, "cash") as Sale["payment"]),
    customerId: (r.customer_id as string) || undefined,
    customerName: (r.customer_name as string) || undefined,
    cashierId: str(r.cashier_id),
    createdAt: ts(r.created_at),
  };
}

// ------------------------------------------------------------------
// Fetchers
// ------------------------------------------------------------------

export async function listProducts(orgId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => mapProduct(r as Row));
}

export async function listCustomers(orgId: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => mapCustomer(r as Row));
}

export async function listExpenses(orgId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapExpense(r as Row));
}

export async function listStockMovements(
  orgId: string,
  limit = 50,
): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => mapMovement(r as Row));
}

export async function listSales(orgId: string, limit = 500): Promise<Sale[]> {
  const { data: salesRows, error } = await supabase
    .from("sales")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (salesRows ?? []) as Row[];
  if (!rows.length) return [];
  const ids = rows.map((r) => String(r.id));
  const { data: itemRows } = await supabase
    .from("sale_items")
    .select("*")
    .in("sale_id", ids);
  const byId = new Map<string, Row[]>();
  ((itemRows ?? []) as Row[]).forEach((it) => {
    const k = String(it.sale_id);
    const arr = byId.get(k) ?? [];
    arr.push(it);
    byId.set(k, arr);
  });
  return rows.map((r) => mapSale(r, byId.get(String(r.id)) ?? []));
}

export async function getSale(saleId: string): Promise<Sale | null> {
  const { data: r } = await supabase.from("sales").select("*").eq("id", saleId).maybeSingle();
  if (!r) return null;
  const { data: items } = await supabase
    .from("sale_items")
    .select("*")
    .eq("sale_id", saleId);
  return mapSale(r as Row, (items ?? []) as Row[]);
}

// ------------------------------------------------------------------
// Mutations
// ------------------------------------------------------------------

export interface ProductInput {
  name: string;
  category?: string;
  barcode?: string;
  costPrice: number;
  price: number;
  stock: number;
  minStock: number;
  unit?: string;
  description?: string;
  image?: string;
}

export async function upsertProduct(
  orgId: string,
  input: ProductInput,
  id?: string,
) {
  const payload = {
    org_id: orgId,
    name: input.name,
    category: input.category || "General",
    barcode: input.barcode || null,
    cost_price: input.costPrice,
    price: input.price,
    stock: input.stock,
    min_stock: input.minStock,
    unit: input.unit || null,
    description: input.description || null,
    image: input.image || null,
    updated_at: new Date().toISOString(),
  };
  if (id) {
    const { error } = await supabase.from("products").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("products").insert(payload);
    if (error) throw error;
  }
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertCustomer(
  orgId: string,
  input: { name: string; phone: string; address?: string },
  id?: string,
): Promise<string> {
  const payload = {
    org_id: orgId,
    name: input.name,
    phone: input.phone || null,
    address: input.address || null,
  };
  if (id) {
    const { error } = await supabase.from("customers").update(payload).eq("id", id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

export async function deleteCustomer(id: string) {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
}

export async function addExpense(
  orgId: string,
  input: { category: Expense["category"]; amount: number; note?: string },
) {
  const { error } = await supabase.from("expenses").insert({
    org_id: orgId,
    category: input.category,
    amount: input.amount,
    note: input.note || null,
  });
  if (error) throw error;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function adjustStock(
  orgId: string,
  input: {
    productId: string;
    mode: "in" | "out" | "adj";
    amount: number;
    note?: string;
    userId: string;
  },
): Promise<void> {
  const { data: prodRow, error: fetchErr } = await supabase
    .from("products")
    .select("id, name, stock")
    .eq("id", input.productId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!prodRow) throw new Error("Product not found");
  const before = Number(prodRow.stock);
  let after = before;
  let change = 0;
  if (input.mode === "in") { after = before + input.amount; change = input.amount; }
  else if (input.mode === "out") { after = Math.max(0, before - input.amount); change = -(before - after); }
  else { after = input.amount; change = after - before; }

  const { error: updErr } = await supabase
    .from("products")
    .update({ stock: after, updated_at: new Date().toISOString() })
    .eq("id", input.productId);
  if (updErr) throw updErr;
  const { error: mvErr } = await supabase.from("stock_movements").insert({
    org_id: orgId,
    product_id: input.productId,
    product_name: String(prodRow.name),
    type: input.mode === "adj" ? "adjust" : input.mode,
    qty: change,
    before_qty: before,
    after_qty: after,
    user_id: input.userId,
    note: input.note || null,
  });
  if (mvErr) throw mvErr;
}

export interface RecordSaleInput {
  items: Array<{
    productId?: string;
    name: string;
    qty: number;
    price: number;
    cost: number;
  }>;
  discount: number;
  payment: Sale["payment"];
  customerId?: string;
  customerName?: string;
}

export async function recordSale(orgId: string, input: RecordSaleInput): Promise<string> {
  const { data, error } = await supabase.rpc("record_sale", {
    _org_id: orgId,
    _items: input.items.map((i) => ({
      product_id: i.productId ?? null,
      name: i.name,
      qty: i.qty,
      price: i.price,
      cost: i.cost,
    })),
    _discount: input.discount,
    _payment: input.payment,
    _customer_id: input.customerId ?? null,
    _customer_name: input.customerName ?? null,
  });
  if (error) throw error;
  return String(data);
}

export async function updateOrgSettings(
  orgId: string,
  patch: Partial<Organization>,
): Promise<void> {
  const upd: Row = {};
  if (patch.businessName !== undefined) upd.business_name = patch.businessName;
  if (patch.phone !== undefined) upd.phone = patch.phone;
  if (patch.address !== undefined) upd.address = patch.address;
  if (patch.currency !== undefined) upd.currency = patch.currency || "TZS";
  if (patch.receiptHeader !== undefined) upd.receipt_header = patch.receiptHeader || null;
  if (patch.receiptFooter !== undefined) upd.receipt_footer = patch.receiptFooter || null;
  if (patch.logo !== undefined) upd.logo = patch.logo || null;
  if (patch.tin !== undefined) upd.tin = patch.tin || null;
  if (patch.vatNumber !== undefined) upd.vat_number = patch.vatNumber || null;
  if (patch.vatRate !== undefined) upd.vat_rate = patch.vatRate ?? null;
  if (patch.website !== undefined) upd.website = patch.website || null;
  const { error } = await supabase.from("organizations").update(upd).eq("id", orgId);
  if (error) throw error;
}

// ------------------------------------------------------------------
// useLive — fetch + subscribe to realtime changes for one org
// ------------------------------------------------------------------

/**
 * Fetches `fetcher(orgId)` on mount / when orgId changes, and re-fetches
 * whenever a realtime change lands on any of the listed tables for this org.
 * Every device that shares the org sees updates within a second.
 */
export function useLive<T>(
  orgId: string | undefined,
  tables: string[],
  fetcher: (orgId: string) => Promise<T>,
  fallback: T,
): { data: T; loading: boolean; refresh: () => Promise<void> } {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    if (!orgId) {
      setData(fallback);
      setLoading(false);
      return;
    }
    try {
      const next = await fetcherRef.current(orgId);
      setData(next);
    } catch (e) {
      console.warn("[useLive] fetch failed", e);
    } finally {
      setLoading(false);
    }
    // fallback is stable per-call site; intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    void refresh();
    if (!orgId) return;
    const chan = supabase.channel(`live-${tables.join("-")}-${orgId}`);
    tables.forEach((table) => {
      chan.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `org_id=eq.${orgId}` },
        () => { void refresh(); },
      );
    });
    chan.subscribe();
    return () => {
      void supabase.removeChannel(chan);
    };
    // tables list is stable per-call site (literal array); safe to depend on join
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, refresh, tables.join("|")]);

  return { data, loading, refresh };
}
