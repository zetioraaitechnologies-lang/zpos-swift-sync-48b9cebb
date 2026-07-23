
CREATE TABLE public.zpos_cloud_backups (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zpos_cloud_backups TO authenticated;
GRANT ALL ON public.zpos_cloud_backups TO service_role;
ALTER TABLE public.zpos_cloud_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own backup select" ON public.zpos_cloud_backups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own backup insert" ON public.zpos_cloud_backups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own backup update" ON public.zpos_cloud_backups FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own backup delete" ON public.zpos_cloud_backups FOR DELETE USING (auth.uid() = user_id);
