// Privileged server actions for ZPOS: super-admin bootstrap and cashier invites.
// All handlers verify the caller with requireSupabaseAuth before doing anything.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Emails that are allowed to claim the super_admin role.
const SUPER_ADMIN_EMAILS = ["zetioraaitechnologies@gmail.com"];

/**
 * Grants the current signed-in user the super_admin role if their email
 * is in the fixed allowlist. Called on sign-in; idempotent.
 */
export const claimSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims?.email ?? "").toString().toLowerCase();
    if (!SUPER_ADMIN_EMAILS.includes(email)) {
      return { granted: false as const };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: context.userId, org_id: null, role: "super_admin" },
        { onConflict: "user_id,org_id,role", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    return { granted: true as const };
  });

/**
 * Owner-only: creates a Supabase auth user for a new cashier (email + password),
 * assigns them the cashier role for the owner's organization, and inserts an
 * employees row so they show up in the staff list.
 */
export const inviteCashier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        orgId: z.string().uuid(),
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        phone: z.string().optional(),
        wage: z.number().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verify caller is the owner of this org.
    const { data: ownerCheck, error: ownerErr } = await context.supabase.rpc(
      "is_org_owner",
      { _user_id: context.userId, _org_id: data.orgId },
    );
    if (ownerErr) throw new Error(ownerErr.message);
    if (!ownerCheck) throw new Error("Forbidden: not the owner of this organization");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create or find the auth user.
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.name, phone: data.phone },
    });
    let newUserId = created?.user?.id;
    if (createErr && !newUserId) {
      // Email already exists — look them up.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find(
        (u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
      );
      if (!found) throw new Error(createErr.message);
      newUserId = found.id;
    }
    if (!newUserId) throw new Error("Could not create user");

    // Assign cashier role for this org.
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: newUserId, org_id: data.orgId, role: "cashier" },
        { onConflict: "user_id,org_id,role", ignoreDuplicates: true },
      );
    if (roleErr) throw new Error(roleErr.message);

    // Employee record (owner-visible list).
    const { error: empErr } = await supabaseAdmin.from("employees").upsert(
      {
        org_id: data.orgId,
        user_id: newUserId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        role_label: "Cashier",
        wage: data.wage,
      },
      { onConflict: "org_id,user_id" },
    );
    // Non-fatal; employees table has no unique on (org_id,user_id) yet — ignore duplicates gracefully
    if (empErr && !/duplicate|conflict/i.test(empErr.message)) {
      // Fall back to plain insert
      await supabaseAdmin.from("employees").insert({
        org_id: data.orgId,
        user_id: newUserId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        role_label: "Cashier",
        wage: data.wage,
      });
    }

    return { userId: newUserId };
  });

/** Owner-only: revoke a cashier's access to this organization. */
export const removeCashier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ orgId: z.string().uuid(), userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_org_owner", {
      _user_id: context.userId,
      _org_id: data.orgId,
    });
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("org_id", data.orgId)
      .eq("role", "cashier");
    await supabaseAdmin
      .from("employees")
      .delete()
      .eq("org_id", data.orgId)
      .eq("user_id", data.userId);
    return { ok: true };
  });

/** Super-admin only: suspend or activate an organization. */
export const setOrgStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ orgId: z.string().uuid(), status: z.enum(["active", "suspended"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ status: data.status })
      .eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Super-admin only: delete an organization (cascades to all its data). */
export const deleteOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("organizations").delete().eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
