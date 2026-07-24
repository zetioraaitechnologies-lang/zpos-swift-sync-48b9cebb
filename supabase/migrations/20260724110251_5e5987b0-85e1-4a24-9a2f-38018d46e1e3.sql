
DROP POLICY IF EXISTS "backup owner insert" ON public.zpos_cloud_backups;
DROP POLICY IF EXISTS "backup owner update" ON public.zpos_cloud_backups;
DROP POLICY IF EXISTS "backup owner delete" ON public.zpos_cloud_backups;

CREATE POLICY "backup member insert" ON public.zpos_cloud_backups
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "backup member update" ON public.zpos_cloud_backups
  FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "backup owner delete" ON public.zpos_cloud_backups
  FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id));
