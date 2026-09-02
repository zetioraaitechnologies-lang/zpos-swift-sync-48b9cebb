-- ZPoS — Bootstrap ya System Admin (endesha BAADA ya 01_zpos_full_schema.sql)
--
-- Nini kinatokea hapa:
--   1. Trigger `handle_new_user` inaboreshwa: mtumiaji WA KWANZA kabisa
--      anayeundwa kwenye Supabase Auth anapewa role ya `super_admin`
--      moja kwa moja. Watumiaji wanaofuata hawapewi role yoyote
--      (wanapewa na super admin kupitia app — closed system).
--   2. Kuna helper `promote_super_admin(email)` endapo utahitaji
--      kumpandisha mtu mwingine mwenyewe baadaye.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _has_super BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  -- Mtumiaji wa kwanza kabisa = super admin wa mfumo.
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') INTO _has_super;
  IF NOT _has_super THEN
    INSERT INTO public.user_roles (user_id, org_id, role)
    VALUES (NEW.id, NULL, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: kumpandisha mtumiaji aliyepo kuwa super admin (kwa email).
CREATE OR REPLACE FUNCTION public.promote_super_admin(_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN 'Hakuna mtumiaji mwenye email hiyo: ' || _email;
  END IF;
  INSERT INTO public.profiles (id, display_name)
  VALUES (_uid, split_part(_email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, org_id, role)
  VALUES (_uid, NULL, 'super_admin')
  ON CONFLICT DO NOTHING;
  RETURN 'OK: ' || _email || ' sasa ni super_admin';
END;
$function$;

REVOKE ALL ON FUNCTION public.promote_super_admin(TEXT) FROM PUBLIC, anon, authenticated;

-- Matumizi (endesha kwenye SQL Editor baada ya kuunda user kwenye Auth):
-- SELECT public.promote_super_admin('email-yako@example.com');
