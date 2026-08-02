DELETE FROM public.user_roles a USING public.user_roles b
WHERE a.ctid < b.ctid AND a.user_id = b.user_id AND a.role = b.role
  AND a.org_id IS NULL AND b.org_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_global_uidx
  ON public.user_roles (user_id, role) WHERE org_id IS NULL;

DELETE FROM public.employees a USING public.employees b
WHERE a.ctid < b.ctid AND a.org_id = b.org_id AND a.user_id = b.user_id AND a.user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employees_org_user_uidx
  ON public.employees (org_id, user_id) WHERE user_id IS NOT NULL;