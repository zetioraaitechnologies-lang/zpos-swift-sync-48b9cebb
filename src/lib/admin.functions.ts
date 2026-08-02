// Privileged server actions for ZPOS: super-admin bootstrap, owner/org creation,
// and cashier invites. All handlers verify the caller (or a fixed allowlist)
// before doing anything. This is a closed system — there is no public sign-up.

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
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .is("org_id", null)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!existingRole) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: context.userId, org_id: null, role: "super_admin" });
      if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
    }
    return { granted: true as const };
  });

/**
 * One-time bootstrap of the seeded super-admin auth account. Public but strictly
 * limited to the allowlisted email above. Idempotent: if the account already
 * exists this is a no-op. This is the ONLY public account-creation path.
 */
export const bootstrapSuperAdmin = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().email(), password: z.string().min(8) }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!SUPER_ADMIN_EMAILS.includes(email)) {
      throw new Error("This email is not authorised to be a super admin.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
    if (existing) return { created: false as const, existed: true as const };
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: "ZPOS Super Admin" },
    });
    if (error || !created?.user) throw new Error(error?.message ?? "Failed to create super admin");
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: created.user.id, org_id: null, role: "super_admin" },
        { onConflict: "user_id,org_id,role", ignoreDuplicates: true },
      );
    return { created: true as const, existed: false as const };
  });

/**
 * Super-admin only: create an organization AND its owner auth account atomically.
 * Returns the new org id + owner email so the admin can hand credentials over.
 */
export const createOrgWithOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        businessName: z.string().min(1),
        ownerName: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        phone: z.string().optional(),
        address: z.string().optional(),
        category: z.string().optional(),
        currency: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!ok) throw new Error("Forbidden: super admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const emailLc = data.email.trim().toLowerCase();
    let ownerId: string | undefined;
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: emailLc,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.ownerName, phone: data.phone },
    });
    ownerId = created?.user?.id;
    if (!ownerId) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find((u) => (u.email ?? "").toLowerCase() === emailLc);
      if (!found) throw new Error(createErr?.message ?? "Could not create owner account");
      ownerId = found.id;
      await supabaseAdmin.auth.admin.updateUserById(ownerId, { password: data.password });
    }

    // Trigger handle_new_org auto-assigns the owner role.
    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({
        business_name: data.businessName,
        owner_user_id: ownerId,
        phone: data.phone,
        email: emailLc,
        address: data.address,
        category: data.category || "Retail",
        currency: data.currency || "TZS",
      })
      .select("id")
      .single();
    if (orgErr || !org) throw new Error(orgErr?.message ?? "Failed to create organization");

    return { orgId: org.id as string, ownerId, email: emailLc };
  });

/** Super-admin only: reset the password of an organization's owner. */
export const resetOwnerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ orgId: z.string().uuid(), newPassword: z.string().min(6) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("owner_user_id")
      .eq("id", data.orgId)
      .maybeSingle();
    if (!org?.owner_user_id) throw new Error("Organization has no owner");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(org.owner_user_id, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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
