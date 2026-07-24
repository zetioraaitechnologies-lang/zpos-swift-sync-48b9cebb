
-- Migrate backups from per-user to per-org keying (org-shared cache).
DROP POLICY IF EXISTS "own backup select" ON public.zpos_cloud_backups;
DROP POLICY IF EXISTS "own backup insert" ON public.zpos_cloud_backups;
DROP POLICY IF EXISTS "own backup update" ON public.zpos_cloud_backups;
DROP POLICY IF EXISTS "own backup delete" ON public.zpos_cloud_backups;

-- Wipe legacy per-user rows (fresh cloud sync via new architecture).
DELETE FROM public.zpos_cloud_backups;

ALTER TABLE public.zpos_cloud_backups DROP CONSTRAINT IF EXISTS zpos_cloud_backups_pkey;
ALTER TABLE public.zpos_cloud_backups DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.zpos_cloud_backups
  ADD COLUMN IF NOT EXISTS org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.zpos_cloud_backups ADD PRIMARY KEY (org_id);
ALTER TABLE public.zpos_cloud_backups REPLICA IDENTITY FULL;

CREATE POLICY "backup org members read" ON public.zpos_cloud_backups
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "backup owner insert" ON public.zpos_cloud_backups
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_owner(auth.uid(), org_id));

CREATE POLICY "backup owner update" ON public.zpos_cloud_backups
  FOR UPDATE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id))
  WITH CHECK (public.is_org_owner(auth.uid(), org_id));

CREATE POLICY "backup owner delete" ON public.zpos_cloud_backups
  FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id));

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.zpos_cloud_backups; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
