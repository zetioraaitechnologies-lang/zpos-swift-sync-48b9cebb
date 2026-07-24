# Refactor to Correct Architecture

This is a substantial migration. I'll do it in ordered phases so the app stays runnable at each step.

## Target Architecture

- **Identity**: Supabase Auth is the only login. Local `AppUser` table removed. Roles stored in a separate `user_roles` table (super_admin / owner / cashier) enforced by a `has_role()` security-definer function.
- **Data**: Real Postgres tables per entity (organizations, products, customers, sales, sale_items, expenses, stock_movements, employees) each carrying `org_id`, protected by RLS scoped to the caller's org + role.
- **Offline**: localStorage becomes a read-through cache + outbound write queue. On reconnect, queued mutations replay against Supabase. Realtime subscriptions keep tabs/devices in sync.
- **Super Admin**: platform-wide role that can list/suspend orgs, view aggregate metrics.
- **Onboarding**: signup → create Organization row (owner auto-assigned `owner` role via trigger) → app usable. Cashiers are invited by owners (email + temp password via admin API in a server fn).

## Phase 1 — Database (this turn)

Single migration:

1. `app_role` enum: `super_admin | owner | cashier`.
2. `organizations` table (business_name, owner_user_id, phone, email, address, category, status, currency, logo, receipt_*, tin, vat_*, timestamps).
3. `user_roles` (user_id, org_id nullable for super_admin, role) + `has_role(_uid, _role)` + `is_org_member(_uid, _org)` security-definer helpers.
4. `profiles` (id = auth.uid, display_name, phone).
5. Domain tables: `products`, `customers`, `sales`, `sale_items`, `expenses`, `stock_movements`, `employees` — all with `org_id`, timestamps, indexes.
6. GRANTs to authenticated + service_role on each. RLS enabled with policies:
   - Super admin: full read; write on organizations (suspend).
   - Owner: full CRUD on rows where `org_id` matches their org.
   - Cashier: read products/customers; insert sales/sale_items/stock_movements/expenses; no delete.
7. Trigger: on new `auth.users`, insert profile. On new `organizations`, insert owner role.
8. Add all tables to `supabase_realtime` publication.
9. Bootstrap super_admin: seed role row for the existing super admin email if that user signs up (handled via a `claim_super_admin` server fn keyed by fixed email allowlist — safer than SQL that can't see auth.users at migration time).
10. Keep `zpos_cloud_backups` for one release as legacy fallback; new code won't write to it.

## Phase 2 — Auth rewrite

- Replace `src/lib/zpos-auth.tsx` with a Supabase-backed `AuthProvider`: `session`, `user`, `role`, `orgId`, `org`, loaded via `onAuthStateChange` + `getUser()`.
- Rewrite `src/routes/login.tsx`: email/password sign-in + sign-up (sign-up creates organization inline for owners; cashiers only sign in with credentials given by owner).
- Add `/onboarding` route for first-time owners with no organization yet.
- Update `_app.tsx` gate to use new auth; `admin.tsx` gates on `role === 'super_admin'`.

## Phase 3 — Data layer

- New `src/lib/zpos-data.ts`: typed CRUD wrappers around Supabase for each entity, scoped by current org.
- New `src/lib/zpos-offline.ts`: IndexedDB-backed cache + mutation queue (via `idb-keyval`), replay on `online` event and app boot.
- Realtime subscription per org that invalidates cache and notifies subscribers.
- Delete `zpos-db.ts` local-store logic; keep the type definitions re-exported from `zpos-data.ts` so existing pages compile.

## Phase 4 — Screen migration

Update each screen to read/write via `zpos-data`:
POS, Products, Inventory, Customers, Employees, Expenses, Reports, Dashboard, Settings, Admin. Cashier UI hides destructive actions using role.

## Phase 5 — Cleanup

- Remove `zpos-cloud.ts` push/pull UI (replaced by continuous sync).
- Cloud Sync panel becomes "Sync status" showing last sync, queued writes, connectivity.
- Update `CAPACITOR.md` / `VERCEL.md` notes where auth flow changed.

## Technical notes

- Employees table stores non-login staff records (name, role label, wage) separate from `user_roles`. Cashiers who log in exist in both.
- Sales are transactional: server function `record_sale` wraps insert of sale + sale_items + stock decrements + stock_movements in one RPC so offline replay is atomic.
- `sale_items.cost` snapshot preserved for profit calc.
- All money as `numeric(14,2)`.
- Timestamps `timestamptz not null default now()`.

## Scope confirmation

This will touch ~20 files and add one large migration. The app will briefly require every existing local user to sign up again with Supabase Auth — local `AppUser` data is not migrated (passwords aren't recoverable). Existing local product/sales data on a device is not auto-imported; I can add a one-time "import my local data to cloud" button in Settings if you want.

Proceed with Phase 1 (migration) now?
