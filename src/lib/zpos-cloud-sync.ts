// Automatic bidirectional cloud sync for ZPoS.
//
// Behavior:
// - When a user is signed into cloud auth, on app boot we PULL their backup
//   into localStorage so the same data appears on any browser/device.
// - Every local write is debounced-pushed to the cloud (~1.5s after the last
//   change) so all tabs/devices converge without a manual "Backup" click.
// - A Supabase Realtime subscription on the user's own backup row pulls
//   remote updates written by another device.
//
// Uses the same table + client as zpos-cloud.ts (public.zpos_cloud_backups).

import { supabase } from "@/integrations/supabase/client";
import { zdb } from "./zpos-db";

const DB_KEY = "zpos:db:v2";
const LAST_HASH_KEY = "zpos:cloud:lastHash";
const PUSH_DEBOUNCE_MS = 1500;

let started = false;
let currentUserId: string | null = null;
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

async function pullOnce(): Promise<void> {
  if (!currentUserId) return;
  const { data, error } = await supabase
    .from("zpos_cloud_backups")
    .select("data, updated_at")
    .eq("user_id", currentUserId)
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
    // notify local subscribers (same tab) and other tabs via storage event
    zdb.update(() => {});
  } finally {
    applyingRemote = false;
  }
}

async function pushNow(): Promise<void> {
  if (!currentUserId) return;
  const db = zdb.get();
  const h = hashOf(db);
  if (h === localStorage.getItem(LAST_HASH_KEY)) return;
  const { data, error } = await supabase
    .from("zpos_cloud_backups")
    .upsert(
      { user_id: currentUserId, data: db, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
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
  if (applyingRemote || !currentUserId) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow();
  }, PUSH_DEBOUNCE_MS);
}

function attachRealtime() {
  if (!currentUserId) return;
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  realtimeChannel = supabase
    .channel(`zpos-backup-${currentUserId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "zpos_cloud_backups",
        filter: `user_id=eq.${currentUserId}`,
      },
      (payload) => {
        const newAt = (payload.new as { updated_at?: string } | null)?.updated_at;
        if (newAt && newAt === lastRemoteAt) return; // our own write
        void pullOnce();
      },
    )
    .subscribe();
}

async function bindToUser(userId: string | null) {
  if (userId === currentUserId) return;
  currentUserId = userId;
  if (realtimeChannel) {
    await supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  if (!userId) return;
  await pullOnce();
  attachRealtime();
  // If cloud had no row yet, push local seed so a fresh device gets the same data.
  await pushNow();
}

/** Start automatic cloud sync. Safe to call once at app boot. */
export function startCloudSync() {
  if (started || typeof window === "undefined") return;
  started = true;

  void supabase.auth.getUser().then(({ data }) => bindToUser(data.user?.id ?? null));

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
      void bindToUser(session?.user?.id ?? null);
    }
  });

  unsubscribeDb = zdb.subscribe(() => schedulePush());

  // Flush any pending push before the tab closes.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
      void pushNow();
    }
  });
}

/** Test/teardown helper. */
export function _stopCloudSync() {
  started = false;
  if (unsubscribeDb) unsubscribeDb();
  unsubscribeDb = null;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  if (realtimeChannel) void supabase.removeChannel(realtimeChannel);
  realtimeChannel = null;
  currentUserId = null;
}
