// Operations layer: kitchen/store → staff handovers and branch-to-branch
// stock transfers. Both are org-scoped and read through the same `useLive`
// hook as the rest of the app.

import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, unknown>;
const num = (v: unknown, d = 0) => (v == null ? d : Number(v));
const str = (v: unknown, d = "") => (v == null ? d : String(v));
const ts = (v: unknown) => (v ? new Date(v as string).getTime() : Date.now());

// ------------------------------------------------------------------
// Handovers (kitchen issued 20 → waiter received 20 → sold 18 → returned 2)
// ------------------------------------------------------------------

export interface Handover {
  id: string;
  orgId: string;
  productId?: string;
  productName: string;
  unit?: string;
  issuedQty: number;
  receivedQty: number;
  soldQty: number;
  returnedQty: number;
  staffName: string;
  staffUserId?: string;
  issuedBy: string;
  status: "open" | "closed";
  note?: string;
  createdAt: number;
  updatedAt: number;
}

function mapHandover(r: Row): Handover {
  return {
    id: str(r.id),
    orgId: str(r.org_id),
    productId: (r.product_id as string) || undefined,
    productName: str(r.product_name),
    unit: (r.unit as string) || undefined,
    issuedQty: num(r.issued_qty),
    receivedQty: num(r.received_qty),
    soldQty: num(r.sold_qty),
    returnedQty: num(r.returned_qty),
    staffName: str(r.staff_name),
    staffUserId: (r.staff_user_id as string) || undefined,
    issuedBy: str(r.issued_by),
    status: str(r.status, "open") === "closed" ? "closed" : "open",
    note: (r.note as string) || undefined,
    createdAt: ts(r.created_at),
    updatedAt: ts(r.updated_at),
  };
}

/** issued − (sold + returned): what is still unaccounted for. */
export function handoverVariance(h: Handover): number {
  return Number((h.receivedQty - h.soldQty - h.returnedQty).toFixed(3));
}

export async function listHandovers(orgId: string, limit = 300): Promise<Handover[]> {
  const { data, error } = await supabase
    .from("handovers")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => mapHandover(r as Row));
}

export interface HandoverInput {
  productId?: string;
  productName: string;
  unit?: string;
  issuedQty: number;
  receivedQty: number;
  staffName: string;
  staffUserId?: string;
  note?: string;
}

export async function createHandover(
  orgId: string,
  userId: string,
  input: HandoverInput,
): Promise<string> {
  const { data, error } = await supabase
    .from("handovers")
    .insert({
      org_id: orgId,
      product_id: input.productId ?? null,
      product_name: input.productName,
      unit: input.unit ?? null,
      issued_qty: input.issuedQty,
      received_qty: input.receivedQty,
      staff_name: input.staffName,
      staff_user_id: input.staffUserId ?? null,
      issued_by: userId,
      note: input.note ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

export async function updateHandover(
  id: string,
  patch: Partial<Pick<Handover, "receivedQty" | "soldQty" | "returnedQty" | "note" | "status">>,
) {
  const upd: Row = {};
  if (patch.receivedQty !== undefined) upd.received_qty = patch.receivedQty;
  if (patch.soldQty !== undefined) upd.sold_qty = patch.soldQty;
  if (patch.returnedQty !== undefined) upd.returned_qty = patch.returnedQty;
  if (patch.note !== undefined) upd.note = patch.note || null;
  if (patch.status !== undefined) upd.status = patch.status;
  const { error } = await supabase.from("handovers").update(upd).eq("id", id);
  if (error) throw error;
}

export async function deleteHandover(id: string) {
  const { error } = await supabase.from("handovers").delete().eq("id", id);
  if (error) throw error;
}

// ------------------------------------------------------------------
// Store transfers (branch → branch)
// ------------------------------------------------------------------

export interface StoreTransfer {
  id: string;
  fromOrgId: string;
  toOrgId: string;
  productId?: string;
  productName: string;
  unit?: string;
  qty: number;
  status: "pending" | "received" | "cancelled";
  note?: string;
  createdBy: string;
  receivedBy?: string;
  createdAt: number;
  receivedAt?: number;
}

function mapTransfer(r: Row): StoreTransfer {
  return {
    id: str(r.id),
    fromOrgId: str(r.from_org_id),
    toOrgId: str(r.to_org_id),
    productId: (r.product_id as string) || undefined,
    productName: str(r.product_name),
    unit: (r.unit as string) || undefined,
    qty: num(r.qty),
    status: str(r.status, "pending") as StoreTransfer["status"],
    note: (r.note as string) || undefined,
    createdBy: str(r.created_by),
    receivedBy: (r.received_by as string) || undefined,
    createdAt: ts(r.created_at),
    receivedAt: r.received_at ? ts(r.received_at) : undefined,
  };
}

export async function listTransfers(orgId: string, limit = 200): Promise<StoreTransfer[]> {
  const { data, error } = await supabase
    .from("store_transfers")
    .select("*")
    .or(`from_org_id.eq.${orgId},to_org_id.eq.${orgId}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => mapTransfer(r as Row));
}

export async function createTransfer(input: {
  fromOrgId: string;
  toOrgId: string;
  productId: string;
  qty: number;
  note?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_store_transfer", {
    _from_org_id: input.fromOrgId,
    _to_org_id: input.toOrgId,
    _product_id: input.productId,
    _qty: input.qty,
    _note: input.note ?? null,
  } as never);
  if (error) throw error;
  return String(data);
}

export async function receiveTransfer(id: string) {
  const { error } = await supabase.rpc("receive_store_transfer", {
    _transfer_id: id,
  } as never);
  if (error) throw error;
}

export async function cancelTransfer(id: string) {
  const { error } = await supabase.rpc("cancel_store_transfer", {
    _transfer_id: id,
  } as never);
  if (error) throw error;
}
