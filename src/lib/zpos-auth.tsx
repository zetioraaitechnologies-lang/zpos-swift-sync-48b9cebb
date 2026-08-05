// ZPOS Auth — Supabase-backed, closed system.
//
// Identity: Supabase Auth (email + password) is the single source of truth.
// Role & org come from `public.user_roles` (super_admin | owner | cashier).
// Business details come from `public.organizations`.
//
// Rules enforced here:
//   * No public sign-up — only seeded super-admin + admin-created owners.
//   * Unknown users (no role row) are rejected instead of defaulting to owner.
//   * Suspended organizations block owner/cashier access.
//   * Profile display name is fetched from `public.profiles`.
//   * Super-admin claim only runs for the allowlisted email.

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
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { claimSuperAdmin } from "./admin.functions";

export type UserRole = "super_admin" | "owner" | "cashier";

export interface AppUser {
  id: string;
  email: string;
  phone?: string;
  name: string;
  role: UserRole;
  orgId?: string;
}

export type { Organization } from "./zpos-data";
import type { Organization } from "./zpos-data";

interface AuthCtx {
  user: AppUser | null;
  org: Organization | null;
  ready: boolean;
  isOnline: boolean;
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

const SUPER_ADMIN_EMAILS = ["zetioraaitechnologies@gmail.com"];

function rowToOrg(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    businessName: (row.business_name as string) ?? "",
    ownerName: "",
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

async function loadProfileName(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return (data?.display_name as string | null) ?? null;
}

async function loadRoleAndOrg(
  userId: string,
  email: string,
): Promise<{ user: AppUser | null; org: Organization | null; error?: string }> {
  const { data: roles, error: rolesErr } = await supabase
    .from("user_roles")
    .select("user_id, org_id, role")
    .eq("user_id", userId);
  if (rolesErr) return { user: null, org: null, error: rolesErr.message };

  const rows = (roles ?? []) as RoleRow[];
  if (rows.length === 0) {
    return { user: null, org: null, error: "This account is not assigned to any organization." };
  }

  const super_ = rows.find((r) => r.role === "super_admin");
  if (super_) {
    const name = (await loadProfileName(userId)) || email.split("@")[0];
    return {
      user: { id: userId, email, name, role: "super_admin" },
      org: null,
    };
  }

  const owner = rows.find((r) => r.role === "owner" && r.org_id);
  const cashier = rows.find((r) => r.role === "cashier" && r.org_id);
  const active = owner ?? cashier;
  if (!active?.org_id) {
    return { user: null, org: null, error: "This account has no organization assigned." };
  }

  const { data: orgRow, error: orgErr } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", active.org_id)
    .maybeSingle();
  if (orgErr) return { user: null, org: null, error: orgErr.message };
  if (!orgRow) return { user: null, org: null, error: "Organization not found." };

  const org = rowToOrg(orgRow as Record<string, unknown>);
  if (org.status === "suspended") {
    return { user: null, org: null, error: "This organization has been suspended. Contact support." };
  }

  const name = (await loadProfileName(userId)) || email.split("@")[0];
  return {
    user: {
      id: userId,
      email,
      name,
      role: owner ? "owner" : "cashier",
      orgId: active.org_id,
    },
    org,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [ready, setReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const claimedRef = useRef<string | null>(null);
  const router = useRouter();

  const applySession = useCallback(async (session: { user: { id: string; email?: string | null } } | null) => {
    if (!session?.user) {
      setUser(null);
      setOrg(null);
      return;
    }

    const email = (session.user.email ?? "").toLowerCase();

    // Bootstrap super_admin once per session, only for allowlisted email.
    if (claimedRef.current !== session.user.id && SUPER_ADMIN_EMAILS.includes(email)) {
      claimedRef.current = session.user.id;
      try {
        await claimSuperAdmin();
      } catch {
        /* not fatal */
      }
    }

    const result = await loadRoleAndOrg(session.user.id, email);
    if (result.error) {
      // Sign out unknown/unassigned accounts so they can't wander the app.
      await supabase.auth.signOut();
      setUser(null);
      setOrg(null);
      return;
    }
    setUser(result.user);
    setOrg(result.org);
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
      if (event === "SIGNED_OUT") router.invalidate();
    });

    const setOnline = () => setIsOnline(navigator.onLine);
    setOnline();
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOnline);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOnline);
    };
  }, [applySession, router]);

  const login: AuthCtx["login"] = async (identifier, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: identifier.trim(),
      password,
    });
    if (error) return { ok: false, error: error.message };
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
    () => ({ user, org, ready, isOnline, login, logout, refresh }),
    [user, org, ready, isOnline],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
