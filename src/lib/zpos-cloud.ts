// Legacy cloud helpers — retained only for the CloudSyncPanel UI.
// The org-shared cloud backup is now managed automatically by zpos-cloud-sync.ts;
// these functions are thin manual controls over the same table.

import { supabase } from "@/integrations/supabase/client";
import { zdb } from "./zpos-db";

const DB_KEY = "zpos:db:v2";

export interface CloudUser {
  id: string;
  email: string | null;
}

async function currentOrgId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("org_id")
    .eq("user_id", userId)
    .in("role", ["owner", "cashier"])
    .not("org_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

export async function cloudGetUser(): Promise<CloudUser | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function cloudSignIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function cloudSignUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
  if (error) throw error;
  return data;
}

export async function cloudSignOut() {
  await supabase.auth.signOut();
}

export async function cloudPush(): Promise<{ updatedAt: string }> {
  const user = await cloudGetUser();
  if (!user) throw new Error("Sign in first");
  const orgId = await currentOrgId(user.id);
  if (!orgId) throw new Error("No organization yet — create one to enable cloud sync");
  const db = zdb.get();
  const { data, error } = await supabase
    .from("zpos_cloud_backups")
    .upsert(
      {
        org_id: orgId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: db as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    )
    .select("updated_at")
    .single();
  if (error) throw error;
  return { updatedAt: data.updated_at as string };
}

export async function cloudPull(): Promise<{ updatedAt: string } | null> {
  const user = await cloudGetUser();
  if (!user) throw new Error("Sign in first");
  const orgId = await currentOrgId(user.id);
  if (!orgId) return null;
  const { data, error } = await supabase
    .from("zpos_cloud_backups")
    .select("data, updated_at")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  localStorage.setItem(DB_KEY, JSON.stringify(data.data));
  zdb.update(() => {});
  return { updatedAt: data.updated_at as string };
}

export async function cloudLastBackupAt(): Promise<string | null> {
  const user = await cloudGetUser();
  if (!user) return null;
  const orgId = await currentOrgId(user.id);
  if (!orgId) return null;
  const { data } = await supabase
    .from("zpos_cloud_backups")
    .select("updated_at")
    .eq("org_id", orgId)
    .maybeSingle();
  return (data?.updated_at as string) ?? null;
}
