// Automatic bidirectional cloud sync for ZPOS, keyed by ORGANIZATION.
// - On sign-in we look up the caller's org via user_roles and pull that org's
//   shared backup blob into localStorage so all devices for the same business
//   see the same data.
// - Every local write is debounced-pushed (~1.5s) to the org's row.
// - Realtime on that row pulls remote updates from other devices live.

import { supabase } from "@/integrations/supabase/client";
import { zdb } from "./zpos-db";

const DB_KEY = "zpos:db:v2";
const LAST_HASH_KEY = "zpos:cloud:lastHash";
const PUSH_DEBOUNCE_MS = 1500;

let started = false;
let currentOrgId: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeDb: (() => void) | null = null;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let applyingRemote = false;
let lastRemoteAt: string | null = null;

function hashOf(obj: unknown): string {
  const s = JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return String(h);
}

async function resolveOrgIdFor(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("org_id, role")
    .eq("user_id", userId)
    .in("role", ["owner", "cashier"])
    .not("org_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

async function pullOnce(): Promise<void> {
  if (!currentOrgId) return;
  const { data, error } = await supabase
    .from("zpos_cloud_backups")
    .select("data, updated_at")
    .eq("org_id", currentOrgId)
    .maybeSingle();
  if (error || !data) return;
  const remoteHash = hashOf(data.data);
  const localHash = localStorage.getItem(LAST_HASH_KEY);
  if (remoteHash === localHash) {
    lastRemoteAt = data.updated_at as string;
    return;
  }
  applyingRemote = true;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data.data));
    localStorage.setItem(LAST_HASH_KEY, remoteHash);
    lastRemoteAt = data.updated_at as string;
    zdb.update(() => {});
  } finally {
    applyingRemote = false;
  }
}

async function pushNow(): Promise<void> {
  if (!currentOrgId) return;
  const db = zdb.get();
  const h = hashOf(db);
  if (h === localStorage.getItem(LAST_HASH_KEY)) return;
  const { data, error } = await supabase
    .from("zpos_cloud_backups")
    .upsert(
      {
        org_id: currentOrgId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: db as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    )
    .select("updated_at")
    .single();
  if (error) {
    console.warn("[cloud-sync] push failed", error.message);
    return;
  }
  localStorage.setItem(LAST_HASH_KEY, h);
  lastRemoteAt = data.updated_at as string;
}

function schedulePush() {
  if (applyingRemote || !currentOrgId) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow();
  }, PUSH_DEBOUNCE_MS);
}

function attachRealtime() {
  if (!currentOrgId) return;
  if (realtimeChannel) {
    void supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  realtimeChannel = supabase
    .channel(`zpos-backup-${currentOrgId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "zpos_cloud_backups",
        filter: `org_id=eq.${currentOrgId}`,
      },
      (payload) => {
        const newAt = (payload.new as { updated_at?: string } | null)?.updated_at;
        if (newAt && newAt === lastRemoteAt) return;
        void pullOnce();
      },
    )
    .subscribe();
}

async function bindToOrg(orgId: string | null) {
  if (orgId === currentOrgId) return;
  currentOrgId = orgId;
  if (realtimeChannel) {
    await supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  // New org context — clear stale hash so first pull is guaranteed to apply.
  localStorage.removeItem(LAST_HASH_KEY);
  if (!orgId) return;
  await pullOnce();
  attachRealtime();
  // If the org's row doesn't exist yet, push local blob so a fresh device
  // still ends up with something. Guarded by hash so it's a no-op if already
  // in sync.
  await pushNow();
}

/** Start automatic cloud sync. Safe to call once at app boot. */
export function startCloudSync() {
  if (started || typeof window === "undefined") return;
  started = true;

  const bindFromSession = async (userId: string | null | undefined) => {
    if (!userId) {
      await bindToOrg(null);
      return;
    }
    const orgId = await resolveOrgIdFor(userId);
    await bindToOrg(orgId);
  };

  void supabase.auth.getUser().then(({ data }) => bindFromSession(data.user?.id));

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      void bindFromSession(session?.user?.id);
    }
  });

  unsubscribeDb = zdb.subscribe(() => schedulePush());

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
      void pushNow();
    }
  });
}

export function _stopCloudSync() {
  started = false;
  if (unsubscribeDb) unsubscribeDb();
  unsubscribeDb = null;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  if (realtimeChannel) void supabase.removeChannel(realtimeChannel);
  realtimeChannel = null;
  currentOrgId = null;
}

export async function currentSyncOrgId() {
  return currentOrgId;
}
