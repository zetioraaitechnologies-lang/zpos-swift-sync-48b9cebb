// Cloud sync for ZPoS offline data.
// Uses the platform auth to identify a user, then mirrors the full
// local zdb blob into public.zpos_cloud_backups (one row per user).
import { supabase } from "@/integrations/supabase/client";
import { zdb } from "./zpos-db";

const DB_KEY = "zpos:db:v2";
const CLOUD_SESSION_KEY = "zpos:cloud:lastEmail";

export interface CloudUser {
  id: string;
  email: string | null;
}

export async function cloudGetUser(): Promise<CloudUser | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function cloudSignUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
  if (error) throw error;
  localStorage.setItem(CLOUD_SESSION_KEY, email);
  return data;
}

export async function cloudSignIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  localStorage.setItem(CLOUD_SESSION_KEY, email);
  return data;
}

export async function cloudSignOut() {
  await supabase.auth.signOut();
}

/** Push the full local database blob (all offline data + files as data URLs) to the cloud. */
export async function cloudPush(): Promise<{ updatedAt: string }> {
  const user = await cloudGetUser();
  if (!user) throw new Error("Sign in to cloud first");
  const db = zdb.get();
  const payload = {
    user_id: user.id,
    data: db as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("zpos_cloud_backups")
    .upsert(payload, { onConflict: "user_id" })
    .select("updated_at")
    .single();
  if (error) throw error;
  return { updatedAt: data.updated_at as string };
}

/** Pull the cloud backup and replace the local database. */
export async function cloudPull(): Promise<{ updatedAt: string } | null> {
  const user = await cloudGetUser();
  if (!user) throw new Error("Sign in to cloud first");
  const { data, error } = await supabase
    .from("zpos_cloud_backups")
    .select("data, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  localStorage.setItem(DB_KEY, JSON.stringify(data.data));
  // trigger listeners
  zdb.update(() => {});
  return { updatedAt: data.updated_at as string };
}

export async function cloudLastBackupAt(): Promise<string | null> {
  const user = await cloudGetUser();
  if (!user) return null;
  const { data } = await supabase
    .from("zpos_cloud_backups")
    .select("updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data?.updated_at as string) ?? null;
}
