-- 03_employees_roles_unique_constraints.sql
--
-- Inarekebisha error: "there is no unique or exclusion constraint matching
-- the ON CONFLICT specification".
--
-- Sababu: unique indexes za awali zilikuwa PARTIAL (zenye WHERE), ambazo
-- Postgres hazikubalii kama lengo la ON CONFLICT. Hapa tunaongeza UNIQUE
-- constraints kamili (named) kwenye employees(org_id, user_id) na
-- user_roles(user_id, org_id, role) — NULLS NOT DISTINCT kadiri inavyowezekana.
--
-- Endesha faili hili mara MOJA kwenye SQL Editor ya Supabase yako. Ni salama
-- kulirudia (IF NOT EXISTS / dedupe kwanza).

-- 1) Ondoa duplicate rows kwanza (sharti kabla ya kuweka constraint).
DELETE FROM public.employees a USING public.employees b
WHERE a.ctid < b.ctid
  AND a.org_id = b.org_id
  AND a.user_id IS NOT NULL
  AND a.user_id = b.user_id;

DELETE FROM public.user_roles a USING public.user_roles b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.role = b.role
  AND (a.org_id = b.org_id OR (a.org_id IS NULL AND b.org_id IS NULL));

-- 2) UNIQUE constraint kamili kwenye employees(org_id, user_id).
--    NULLS NOT DISTINCT inahitaji Postgres 15+; tumejaza fallback chini.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_org_user_key' AND conrelid = 'public.employees'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.employees
        ADD CONSTRAINT employees_org_user_key UNIQUE NULLS NOT DISTINCT (org_id, user_id);
    EXCEPTION WHEN feature_not_supported OR syntax_error THEN
      -- Postgres < 15: tumia expression index badala yake (bado ON CONFLICT
      -- isiyotumika; server code inatumia check-then-insert kwa hili).
      CREATE UNIQUE INDEX employees_org_user_key
        ON public.employees (org_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
    END;
  END IF;
END $$;

-- 3) UNIQUE constraint kamili kwenye user_roles(user_id, org_id, role).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_user_org_role_key' AND conrelid = 'public.user_roles'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.user_roles
        ADD CONSTRAINT user_roles_user_org_role_key UNIQUE NULLS NOT DISTINCT (user_id, org_id, role);
    EXCEPTION WHEN feature_not_supported OR syntax_error THEN
      CREATE UNIQUE INDEX user_roles_user_org_role_key
        ON public.user_roles (user_id, COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid), role);
    END;
  END IF;
END $$;
