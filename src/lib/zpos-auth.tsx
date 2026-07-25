// ZPOS Auth — Supabase-backed.
//
// Identity: Supabase Auth (email + password) is the single source of truth.
// Role & org come from `public.user_roles` (super_admin | owner | cashier).
// Business details come from `public.organizations`.
//
// The rest of the app still consumes `useAuth()` and the same `AppUser` /
// `Organization` shapes as before, so screens keep working. On sign-in the
// cloud sync layer hydrates the local `zdb` blob from the org-shared cloud
// backup so all devices in an org see the same data.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { claimSuperAdmin } from "./admin.functions";
import type { AppUser, Organization } from "./zpos-db";
import { zdb } from "./zpos-db";

const DB_KEY = "zpos:db:v2";
const LAST_HASH_KEY = "zpos:cloud:lastHash";

interface AuthCtx {
  user: AppUser | null;
  org: Organization | null;
  ready: boolean;
  login: (
    identifier: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

interface RoleRow {
  user_id: string;
  org_id: string | null;
  role: "super_admin" | "owner" | "cashier";
}

function rowToOrg(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    businessName: (row.business_name as string) ?? "",
    ownerName: "", // populated from profile if needed
    phone: (row.phone as string) ?? "",
    email: (row.email as string) ?? "",
    address: (row.address as string) ?? "",
    category: (row.category as string) ?? "",
    status: ((row.status as string) === "suspended" ? "suspended" : "active"),
    createdAt: row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
    currency: (row.currency as string) ?? "TZS",
    logo: (row.logo as string) || undefined,
    receiptFooter: (row.receipt_footer as string) || undefined,
    receiptHeader: (row.receipt_header as string) || undefined,
    tin: (row.tin as string) || undefined,
    vatNumber: (row.vat_number as string) || undefined,
    vatRate: row.vat_rate == null ? undefined : Number(row.vat_rate),
    website: (row.website as string) || undefined,
  };
}

async function loadRoleAndOrg(
  userId: string,
): Promise<{ role: AppUser["role"]; orgId?: string; org: Organization | null }> {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id, org_id, role")
    .eq("user_id", userId);
  const rows = (roles ?? []) as RoleRow[];
  const super_ = rows.find((r) => r.role === "super_admin");
  if (super_) return { role: "super_admin", org: null };
  const owner = rows.find((r) => r.role === "owner" && r.org_id);
  const cashier = rows.find((r) => r.role === "cashier" && r.org_id);
  const active = owner ?? cashier;
  if (!active) return { role: "owner", org: null }; // needs onboarding
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", active.org_id!)
    .maybeSingle();
  return {
    role: owner ? "owner" : "cashier",
    orgId: active.org_id!,
    org: orgRow ? rowToOrg(orgRow as Record<string, unknown>) : null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [ready, setReady] = useState(false);
  const claimedRef = useRef<string | null>(null);

  const applySession = useCallback(async (session: { user: { id: string; email?: string | null } } | null) => {
    if (!session?.user) {
      setUser(null);
      setOrg(null);
      // Wipe local blob & sync markers so the next signed-in user starts clean.
      try {
        localStorage.removeItem(DB_KEY);
        localStorage.removeItem(LAST_HASH_KEY);
      } catch {
        /* noop */
      }
      zdb.reset();
      return;
    }

    // Bootstrap super_admin once per session (idempotent).
    if (claimedRef.current !== session.user.id) {
      claimedRef.current = session.user.id;
      try {
        await claimSuperAdmin();
      } catch {
        /* not fatal — user just isn't a super admin */
      }
    }

    const { role, orgId, org: orgRow } = await loadRoleAndOrg(session.user.id);
    setUser({
      id: session.user.id,
      email: session.user.email ?? "",
      name: session.user.email?.split("@")[0] ?? "User",
      password: "",
      role,
      orgId,
    });
    setOrg(orgRow);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      await applySession(data.session as never);
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void applySession(session as never);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const login: AuthCtx["login"] = async (identifier, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: identifier.trim(),
      password,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const signUpOwner: AuthCtx["signUpOwner"] = async (input) => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: input.ownerName },
      },
    });
    if (error) return { ok: false, error: error.message };

    // If email confirmation is required and there's no session yet, we can't
    // create the org (INSERT policy needs auth.uid()). Owner will need to
    // confirm email and then complete onboarding on first sign-in.
    if (!data.session) {
      return {
        ok: true,
        error: "Check your email to confirm your account, then sign in to finish setup.",
      };
    }

    const { error: orgErr } = await supabase.from("organizations").insert({
      business_name: input.businessName,
      owner_user_id: data.user!.id,
      phone: input.phone,
      email: input.email.trim(),
      address: input.address,
      category: input.category || "Retail",
      currency: input.currency || "TZS",
    });
    if (orgErr) return { ok: false, error: orgErr.message };

    // Refresh so we pick up role + org immediately.
    await applySession({ user: data.user! });
    return { ok: true };
  };

  const logout: AuthCtx["logout"] = async () => {
    await supabase.auth.signOut();
  };

  const refresh: AuthCtx["refresh"] = async () => {
    const { data } = await supabase.auth.getSession();
    await applySession(data.session as never);
  };

  const value = useMemo(
    () => ({ user, org, ready, login, signUpOwner, logout, refresh }),
    [user, org, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

// Kept for API compatibility with older screens.
export function useDbVersion() {
  const [, setV] = useState(0);
  useEffect(() => {
    const unsub = zdb.subscribe(() => setV((n) => n + 1));
    return () => {
      unsub();
    };
  }, []);
}
