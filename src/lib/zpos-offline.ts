// ZPOS Offline Write Queue
//
// Critical writes (sales, products, customers, expenses, stock adjustments)
// are attempted online first. When the device is offline or Supabase is
// unreachable, the operation is stored in localStorage and replayed once the
// connection returns. The POS can keep selling while offline; stock is also
// updated in a local cache so the cashier sees current numbers immediately.

import { supabase } from "@/integrations/supabase/client";
import type { Product, Customer, Expense, StockMovement, Sale, RecordSaleInput } from "./zpos-data";
import { recordSale as recordSaleOnline, upsertProduct, upsertCustomer, addExpense, adjustStock, deleteProduct, deleteCustomer, deleteExpense } from "./zpos-data";

const QUEUE_KEY = "zpos:offline:queue";
const CACHE_KEY = "zpos:offline:cache";
const LAST_SYNC_KEY = "zpos:offline:lastSync";

export type QueuedOp =
  | { type: "sale"; id: string; orgId: string; payload: RecordSaleInput; createdAt: number }
  | { type: "upsertProduct"; id: string; orgId: string; input: Parameters<typeof upsertProduct>[1]; productId?: string; createdAt: number }
  | { type: "deleteProduct"; id: string; productId: string; createdAt: number }
  | { type: "upsertCustomer"; id: string; orgId: string; input: { name: string; phone: string; address?: string }; customerId?: string; createdAt: number }
  | { type: "deleteCustomer"; id: string; customerId: string; createdAt: number }
  | { type: "addExpense"; id: string; orgId: string; userId: string; input: { category: Expense["category"]; amount: number; note?: string }; createdAt: number }
  | { type: "deleteExpense"; id: string; expenseId: string; createdAt: number }
  | { type: "adjustStock"; id: string; orgId: string; input: { productId: string; mode: "in" | "out" | "adj"; amount: number; note?: string; userId: string }; createdAt: number };

interface OfflineCache {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  expenses: Expense[];
  stockMovements: StockMovement[];
  updatedAt: number;
}

function now() {
  return Date.now();
}

function uid(prefix = "q") {
  return `${prefix}_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function readQueue(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(q: QueuedOp[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    /* ignore quota errors */
  }
}

export function readCache(): OfflineCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as OfflineCache) : null;
  } catch {
    return null;
  }
}

export function writeCache(cache: OfflineCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...cache, updatedAt: now() }));
    localStorage.setItem(LAST_SYNC_KEY, String(now()));
  } catch {
    /* ignore quota errors */
  }
}

export function isOnline() {
  return typeof navigator !== "undefined" && navigator.onLine;
}

export function pendingCount(): number {
  return readQueue().length;
}

export function lastSyncTime(): number | null {
  try {
    const v = localStorage.getItem(LAST_SYNC_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

/** True if the error looks like a network failure rather than a logic error. */
function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /fetch|network|timeout|offline|failed to fetch|abort/i.test(msg) ||
    !isOnline()
  );
}

/** Add an operation to the offline queue. */
function enqueue(op: QueuedOp) {
  const q = readQueue();
  q.push(op);
  writeQueue(q);
}

/** Remove an operation from the queue by id. */
function dequeue(id: string) {
  writeQueue(readQueue().filter((op) => op.id !== id));
}

// ------------------------------------------------------------------
// Public safe mutations — try online, fall back to queue.
// ------------------------------------------------------------------

export async function safeRecordSale(orgId: string, input: RecordSaleInput): Promise<string> {
  try {
    const id = await recordSaleOnline(orgId, input);
    localStorage.setItem(LAST_SYNC_KEY, String(now()));
    return id;
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    const id = uid("sale");
    enqueue({ type: "sale", id, orgId, payload: input, createdAt: now() });
    // Update local cache immediately so stock appears reduced.
    const cache = readCache();
    if (cache) {
      for (const item of input.items) {
        if (!item.productId) continue;
        const p = cache.products.find((x) => x.id === item.productId);
        if (p) p.stock = Math.max(0, p.stock - item.qty);
      }
      cache.sales.unshift({
        id,
        orgId,
        items: input.items.map((i) => ({ productId: i.productId ?? uid("prod"), name: i.name, qty: i.qty, price: i.price, cost: i.cost })),
        subtotal: input.items.reduce((a, i) => a + i.qty * i.price, 0),
        discount: input.discount,
        total: Math.max(0, input.items.reduce((a, i) => a + i.qty * i.price, 0) - input.discount),
        profit: input.items.reduce((a, i) => a + i.qty * (i.price - i.cost), 0),
        amountPaid:
          input.payment === "credit"
            ? (input.amountPaid ?? 0)
            : Math.max(0, input.items.reduce((a, i) => a + i.qty * i.price, 0) - input.discount),
        payment: input.payment,
        customerId: input.customerId,
        customerName: input.customerName,
        cashierId: "offline",
        createdAt: now(),
      });
      writeCache(cache);
    }
    return id;
  }
}

export async function safeUpsertProduct(orgId: string, input: Parameters<typeof upsertProduct>[1], id?: string) {
  try {
    await upsertProduct(orgId, input, id);
    localStorage.setItem(LAST_SYNC_KEY, String(now()));
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    enqueue({ type: "upsertProduct", id: uid("prod"), orgId, input, productId: id, createdAt: now() });
  }
}

export async function safeDeleteProduct(productId: string) {
  try {
    await deleteProduct(productId);
    localStorage.setItem(LAST_SYNC_KEY, String(now()));
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    enqueue({ type: "deleteProduct", id: uid("delprod"), productId, createdAt: now() });
    const cache = readCache();
    if (cache) {
      cache.products = cache.products.filter((p) => p.id !== productId);
      writeCache(cache);
    }
  }
}

export async function safeUpsertCustomer(orgId: string, input: { name: string; phone: string; address?: string }, id?: string): Promise<string> {
  try {
    const customerId = await upsertCustomer(orgId, input, id);
    localStorage.setItem(LAST_SYNC_KEY, String(now()));
    return customerId;
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    const customerId = id ?? uid("cust");
    enqueue({ type: "upsertCustomer", id: uid("custq"), orgId, input, customerId, createdAt: now() });
    const cache = readCache();
    if (cache) {
      const existing = cache.customers.find((c) => c.id === customerId);
      if (existing) {
        existing.name = input.name;
        existing.phone = input.phone;
        existing.address = input.address;
      } else {
        cache.customers.push({ id: customerId, orgId, name: input.name, phone: input.phone, address: input.address, createdAt: now() });
      }
      writeCache(cache);
    }
    return customerId;
  }
}

export async function safeDeleteCustomer(customerId: string) {
  try {
    await deleteCustomer(customerId);
    localStorage.setItem(LAST_SYNC_KEY, String(now()));
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    enqueue({ type: "deleteCustomer", id: uid("delcust"), customerId, createdAt: now() });
    const cache = readCache();
    if (cache) {
      cache.customers = cache.customers.filter((c) => c.id !== customerId);
      writeCache(cache);
    }
  }
}

export async function safeAddExpense(orgId: string, userId: string, input: { category: Expense["category"]; amount: number; note?: string }) {
  try {
    await addExpense(orgId, userId, input);
    localStorage.setItem(LAST_SYNC_KEY, String(now()));
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    enqueue({ type: "addExpense", id: uid("exp"), orgId, userId, input, createdAt: now() });
    const cache = readCache();
    if (cache) {
      cache.expenses.unshift({ id: uid("exp"), orgId, category: input.category, amount: input.amount, note: input.note, createdAt: now() });
      writeCache(cache);
    }
  }
}

export async function safeDeleteExpense(expenseId: string) {
  try {
    await deleteExpense(expenseId);
    localStorage.setItem(LAST_SYNC_KEY, String(now()));
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    enqueue({ type: "deleteExpense", id: uid("delexp"), expenseId, createdAt: now() });
    const cache = readCache();
    if (cache) {
      cache.expenses = cache.expenses.filter((e) => e.id !== expenseId);
      writeCache(cache);
    }
  }
}

export async function safeAdjustStock(orgId: string, input: { productId: string; mode: "in" | "out" | "adj"; amount: number; note?: string; userId: string }) {
  try {
    await adjustStock(orgId, input);
    localStorage.setItem(LAST_SYNC_KEY, String(now()));
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    enqueue({ type: "adjustStock", id: uid("adj"), orgId, input, createdAt: now() });
    const cache = readCache();
    if (cache) {
      const p = cache.products.find((x) => x.id === input.productId);
      if (p) {
        let after = p.stock;
        if (input.mode === "in") after += input.amount;
        else if (input.mode === "out") after = Math.max(0, after - input.amount);
        else after = input.amount;
        cache.stockMovements.unshift({
          id: uid("mv"),
          orgId,
          productId: input.productId,
          productName: p.name,
          type: input.mode === "adj" ? "adjust" : input.mode,
          qty: after - p.stock,
          before: p.stock,
          after,
          userId: input.userId,
          note: input.note,
          createdAt: now(),
        });
        p.stock = after;
        writeCache(cache);
      }
    }
  }
}

// ------------------------------------------------------------------
// Queue replay
// ------------------------------------------------------------------

export type SyncStatus = { running: boolean; pending: number; error?: string };

type SyncListener = (s: SyncStatus) => void;
const listeners = new Set<SyncListener>();
let running = false;

function emit() {
  const status: SyncStatus = { running, pending: pendingCount() };
  listeners.forEach((l) => l(status));
}

export function subscribeSyncStatus(listener: SyncListener) {
  listeners.add(listener);
  emit();
  return () => listeners.delete(listener);
}

async function replayOp(op: QueuedOp): Promise<boolean> {
  try {
    switch (op.type) {
      case "sale":
        await recordSaleOnline(op.orgId, op.payload);
        break;
      case "upsertProduct":
        await upsertProduct(op.orgId, op.input, op.productId);
        break;
      case "deleteProduct":
        await deleteProduct(op.productId);
        break;
      case "upsertCustomer":
        await upsertCustomer(op.orgId, op.input, op.customerId);
        break;
      case "deleteCustomer":
        await deleteCustomer(op.customerId);
        break;
      case "addExpense":
        await addExpense(op.orgId, op.userId, op.input);
        break;
      case "deleteExpense":
        await deleteExpense(op.expenseId);
        break;
      case "adjustStock":
        await adjustStock(op.orgId, op.input);
        break;
    }
    dequeue(op.id);
    return true;
  } catch (e) {
    if (!isNetworkError(e)) {
      // Logic error — drop it so the queue doesn't get stuck.
      dequeue(op.id);
      console.error("[offline] dropping op due to logic error", op, e);
    }
    return false;
  }
}

export async function processQueue(): Promise<SyncStatus> {
  if (running || !isOnline()) return { running: false, pending: pendingCount() };
  running = true;
  emit();
  try {
    let q = readQueue();
    // Process sales last so products/customers exist first.
    const order = ["upsertProduct", "deleteProduct", "upsertCustomer", "deleteCustomer", "addExpense", "deleteExpense", "adjustStock", "sale"] as const;
    q.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    for (const op of q) {
      await replayOp(op);
    }
    localStorage.setItem(LAST_SYNC_KEY, String(now()));
  } finally {
    running = false;
    emit();
  }
  return { running: false, pending: pendingCount() };
}

/** Call this once at app startup to wire online/offline listeners. */
export function startOfflineEngine() {
  const onOnline = () => {
    void processQueue();
  };
  window.addEventListener("online", onOnline);
  // Initial attempt in case we are already online.
  void processQueue();
  return () => window.removeEventListener("online", onOnline);
}

// ------------------------------------------------------------------
// Local cache helpers for offline reads.
// ------------------------------------------------------------------

export function updateLocalCache(patch: Partial<OfflineCache>) {
  const existing = readCache();
  const next: OfflineCache = {
    products: patch.products ?? existing?.products ?? [],
    customers: patch.customers ?? existing?.customers ?? [],
    sales: patch.sales ?? existing?.sales ?? [],
    expenses: patch.expenses ?? existing?.expenses ?? [],
    stockMovements: patch.stockMovements ?? existing?.stockMovements ?? [],
    updatedAt: now(),
  };
  writeCache(next);
}

export function getCachedProducts(): Product[] {
  return readCache()?.products ?? [];
}

export function getCachedCustomers(): Customer[] {
  return readCache()?.customers ?? [];
}
