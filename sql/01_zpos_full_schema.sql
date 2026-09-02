-- ZPoS — full schema (generated from supabase/migrations, in order)
-- Run this ONCE on a fresh Supabase project (SQL Editor). No data is inserted.

-- ============================================================
-- 20260723155511_ce072532-033f-47b6-a1cf-34e4bd10806b.sql
-- ============================================================

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

-- ============================================================
-- 20260723163654_5a884899-9057-49ee-8360-243e705ddde7.sql
-- ============================================================
ALTER TABLE public.zpos_cloud_backups REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'zpos_cloud_backups'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.zpos_cloud_backups';
  END IF;
END $$;
-- ============================================================
-- 20260724110100_f87f8040-0625-497f-b1e0-4ca2b2065baa.sql
-- ============================================================

-- === ENUMS ===
CREATE TYPE public.app_role AS ENUM ('super_admin', 'owner', 'cashier');
CREATE TYPE public.org_status AS ENUM ('active', 'suspended');
CREATE TYPE public.payment_method AS ENUM ('cash', 'mobile', 'bank');
CREATE TYPE public.expense_category AS ENUM ('Rent', 'Salaries', 'Electricity', 'Transport', 'Others');
CREATE TYPE public.stock_move_type AS ENUM ('in', 'out', 'adjust', 'sale');

-- === UPDATED-AT TRIGGER ===
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- === PROFILES ===
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- === ORGANIZATIONS ===
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  phone TEXT,
  email TEXT,
  address TEXT,
  category TEXT,
  status public.org_status NOT NULL DEFAULT 'active',
  currency TEXT NOT NULL DEFAULT 'TZS',
  logo TEXT,
  receipt_header TEXT,
  receipt_footer TEXT,
  tin TEXT,
  vat_number TEXT,
  vat_rate NUMERIC(5,2),
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER organizations_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- === USER ROLES ===
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id, role)
);
CREATE INDEX user_roles_user_idx ON public.user_roles(user_id);
CREATE INDEX user_roles_org_idx ON public.user_roles(org_id);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- === ROLE HELPER FUNCTIONS (security definer, bypass RLS to avoid recursion) ===
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND org_id = _org_id AND role = 'owner');
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND org_id = _org_id AND role IN ('owner', 'cashier')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_org_id(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.user_roles
  WHERE user_id = _user_id AND role IN ('owner','cashier') AND org_id IS NOT NULL
  ORDER BY created_at ASC LIMIT 1;
$$;

-- Organization policies (need helper functions above)
CREATE POLICY "orgs super admin read all" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "orgs member read own" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));
CREATE POLICY "orgs owner creates own" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "orgs owner updates own" ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_org_owner(auth.uid(), id)) WITH CHECK (public.is_org_owner(auth.uid(), id));
CREATE POLICY "orgs super admin updates" ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- === TRIGGERS: profile on signup, owner role on org create ===
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_org()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, org_id, role)
  VALUES (NEW.owner_user_id, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_org_created AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_org();

-- === DOMAIN TABLES ===
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  barcode TEXT,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  price NUMERIC(14,2) NOT NULL DEFAULT 0,
  stock NUMERIC(14,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit TEXT,
  image TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_org_idx ON public.products(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "products members read" ON public.products FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "products owner writes" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.is_org_owner(auth.uid(), org_id));
CREATE POLICY "products owner updates" ON public.products FOR UPDATE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id)) WITH CHECK (public.is_org_owner(auth.uid(), org_id));
CREATE POLICY "products owner deletes" ON public.products FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id));

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX customers_org_idx ON public.customers(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "customers members read" ON public.customers FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "customers members insert" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "customers owner updates" ON public.customers FOR UPDATE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id)) WITH CHECK (public.is_org_owner(auth.uid(), org_id));
CREATE POLICY "customers owner deletes" ON public.customers FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id));

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  profit NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment public.payment_method NOT NULL DEFAULT 'cash',
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  cashier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sales_org_idx ON public.sales(org_id);
CREATE INDEX sales_created_idx ON public.sales(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales members read" ON public.sales FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "sales members insert" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id) AND cashier_id = auth.uid());
CREATE POLICY "sales owner deletes" ON public.sales FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id));

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  qty NUMERIC(14,2) NOT NULL,
  price NUMERIC(14,2) NOT NULL,
  cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sale_items_sale_idx ON public.sale_items(sale_id);
GRANT SELECT, INSERT, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sale_items via sale" ON public.sale_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
    AND (public.is_org_member(auth.uid(), s.org_id) OR public.is_super_admin(auth.uid()))));
CREATE POLICY "sale_items insert via sale" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
    AND public.is_org_member(auth.uid(), s.org_id)));

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category public.expense_category NOT NULL DEFAULT 'Others',
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX expenses_org_idx ON public.expenses(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses members read" ON public.expenses FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "expenses members insert" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id) AND user_id = auth.uid());
CREATE POLICY "expenses owner updates" ON public.expenses FOR UPDATE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id)) WITH CHECK (public.is_org_owner(auth.uid(), org_id));
CREATE POLICY "expenses owner deletes" ON public.expenses FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id));

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  type public.stock_move_type NOT NULL,
  qty NUMERIC(14,2) NOT NULL,
  before_qty NUMERIC(14,2) NOT NULL,
  after_qty NUMERIC(14,2) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_org_idx ON public.stock_movements(org_id);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_moves members read" ON public.stock_movements FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "stock_moves members insert" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id) AND user_id = auth.uid());

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role_label TEXT,
  wage NUMERIC(14,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX employees_org_idx ON public.employees(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "employees members read" ON public.employees FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "employees owner writes" ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.is_org_owner(auth.uid(), org_id));
CREATE POLICY "employees owner updates" ON public.employees FOR UPDATE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id)) WITH CHECK (public.is_org_owner(auth.uid(), org_id));
CREATE POLICY "employees owner deletes" ON public.employees FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id));

-- === record_sale RPC (atomic) ===
CREATE OR REPLACE FUNCTION public.record_sale(
  _org_id UUID,
  _items JSONB, -- [{product_id, name, qty, price, cost}]
  _discount NUMERIC DEFAULT 0,
  _payment public.payment_method DEFAULT 'cash',
  _customer_id UUID DEFAULT NULL,
  _customer_name TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _sale_id UUID;
  _subtotal NUMERIC(14,2) := 0;
  _profit NUMERIC(14,2) := 0;
  _total NUMERIC(14,2);
  _it JSONB;
  _pid UUID;
  _qty NUMERIC;
  _price NUMERIC;
  _cost NUMERIC;
  _before NUMERIC;
  _after NUMERIC;
  _name TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_org_member(_uid, _org_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_it->>'qty')::NUMERIC;
    _price := (_it->>'price')::NUMERIC;
    _cost := COALESCE((_it->>'cost')::NUMERIC, 0);
    _subtotal := _subtotal + (_qty * _price);
    _profit := _profit + (_qty * (_price - _cost));
  END LOOP;

  _total := GREATEST(_subtotal - COALESCE(_discount,0), 0);

  INSERT INTO public.sales (org_id, subtotal, discount, total, profit, payment, customer_id, customer_name, cashier_id)
  VALUES (_org_id, _subtotal, COALESCE(_discount,0), _total, _profit, _payment, _customer_id, _customer_name, _uid)
  RETURNING id INTO _sale_id;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _pid := NULLIF(_it->>'product_id','')::UUID;
    _name := _it->>'name';
    _qty := (_it->>'qty')::NUMERIC;
    _price := (_it->>'price')::NUMERIC;
    _cost := COALESCE((_it->>'cost')::NUMERIC, 0);

    INSERT INTO public.sale_items (sale_id, product_id, name, qty, price, cost)
    VALUES (_sale_id, _pid, _name, _qty, _price, _cost);

    IF _pid IS NOT NULL THEN
      SELECT stock INTO _before FROM public.products WHERE id = _pid AND org_id = _org_id FOR UPDATE;
      IF _before IS NOT NULL THEN
        _after := _before - _qty;
        UPDATE public.products SET stock = _after WHERE id = _pid;
        INSERT INTO public.stock_movements (org_id, product_id, product_name, type, qty, before_qty, after_qty, user_id, note)
        VALUES (_org_id, _pid, _name, 'sale', _qty, _before, _after, _uid, 'sale ' || _sale_id::text);
      END IF;
    END IF;
  END LOOP;

  RETURN _sale_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_sale(UUID, JSONB, NUMERIC, public.payment_method, UUID, TEXT) TO authenticated;

-- === Realtime ===
ALTER TABLE public.organizations REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.customers REPLICA IDENTITY FULL;
ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.sale_items REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.stock_movements REPLICA IDENTITY FULL;
ALTER TABLE public.employees REPLICA IDENTITY FULL;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.products; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.customers; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sales; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.employees; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============================================================
-- 20260724110119_d598e65a-90aa-414c-9cae-0873894ce5aa.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_owner(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_org_id(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_sale(UUID, JSONB, NUMERIC, public.payment_method, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_owner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id(UUID) TO authenticated;

-- ============================================================
-- 20260724110208_6d1a19e8-1061-4819-b47c-574744d69bbf.sql
-- ============================================================

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

-- ============================================================
-- 20260724110251_5e5987b0-85e1-4a24-9a2f-38018d46e1e3.sql
-- ============================================================

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

-- ============================================================
-- 20260802001150_a341021c-0c2a-4fac-973b-839dde5af9b2.sql
-- ============================================================
DELETE FROM public.user_roles a USING public.user_roles b
WHERE a.ctid < b.ctid AND a.user_id = b.user_id AND a.role = b.role
  AND a.org_id IS NULL AND b.org_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_global_uidx
  ON public.user_roles (user_id, role) WHERE org_id IS NULL;

DELETE FROM public.employees a USING public.employees b
WHERE a.ctid < b.ctid AND a.org_id = b.org_id AND a.user_id = b.user_id AND a.user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employees_org_user_uidx
  ON public.employees (org_id, user_id) WHERE user_id IS NOT NULL;
-- ============================================================
-- 20260806170745_6809a1f1-4c32-401e-9c8b-716731611ffb.sql
-- ============================================================
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'general';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;
-- ============================================================
-- 20260807203602_196ab760-16d6-4d9c-b8bb-0426fe7ec186.sql
-- ============================================================
-- 1. Suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers members read" ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "suppliers members insert" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "suppliers owner updates" ON public.suppliers FOR UPDATE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id)) WITH CHECK (public.is_org_owner(auth.uid(), org_id));
CREATE POLICY "suppliers owner deletes" ON public.suppliers FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id));
CREATE TRIGGER suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Purchases
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases members read" ON public.purchases FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "purchases members insert" ON public.purchases FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id) AND user_id = auth.uid());
CREATE POLICY "purchases owner deletes" ON public.purchases FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id));

CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_items via purchase" ON public.purchase_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = purchase_id
    AND (public.is_org_member(auth.uid(), p.org_id) OR public.is_super_admin(auth.uid()))));
CREATE POLICY "purchase_items insert via purchase" ON public.purchase_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = purchase_id
    AND public.is_org_member(auth.uid(), p.org_id)));

-- 3. Credit sales
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'credit';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0;

CREATE TABLE public.customer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'cash',
  note TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.customer_payments TO authenticated;
GRANT ALL ON public.customer_payments TO service_role;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments members read" ON public.customer_payments FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "payments members insert" ON public.customer_payments FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id) AND user_id = auth.uid());
CREATE POLICY "payments owner deletes" ON public.customer_payments FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id));

-- 4. Product variants
CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size TEXT,
  color TEXT,
  barcode TEXT,
  price NUMERIC(14,2),
  cost_price NUMERIC(14,2),
  stock NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variants members read" ON public.product_variants FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "variants owner writes" ON public.product_variants FOR INSERT TO authenticated
  WITH CHECK (public.is_org_owner(auth.uid(), org_id));
CREATE POLICY "variants owner updates" ON public.product_variants FOR UPDATE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id)) WITH CHECK (public.is_org_owner(auth.uid(), org_id));
CREATE POLICY "variants owner deletes" ON public.product_variants FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id));
CREATE TRIGGER variants_updated BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_org ON public.purchases(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.customer_payments(customer_id);
-- ============================================================
-- 20260807203641_cf394eaa-85df-439a-8300-cc9a81d0233a.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_purchase(
  _org_id uuid,
  _items jsonb,
  _supplier_id uuid DEFAULT NULL,
  _supplier_name text DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _pid_out UUID;
  _total NUMERIC(14,2) := 0;
  _it JSONB;
  _pid UUID; _qty NUMERIC; _cost NUMERIC; _before NUMERIC; _after NUMERIC; _name TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_org_member(_uid, _org_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _total := _total + ((_it->>'qty')::NUMERIC * COALESCE((_it->>'cost')::NUMERIC,0));
  END LOOP;

  INSERT INTO public.purchases (org_id, supplier_id, supplier_name, total, note, user_id)
  VALUES (_org_id, _supplier_id, _supplier_name, _total, _note, _uid)
  RETURNING id INTO _pid_out;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _pid := NULLIF(_it->>'product_id','')::UUID;
    _name := _it->>'name';
    _qty := (_it->>'qty')::NUMERIC;
    _cost := COALESCE((_it->>'cost')::NUMERIC, 0);

    INSERT INTO public.purchase_items (purchase_id, product_id, name, qty, cost)
    VALUES (_pid_out, _pid, _name, _qty, _cost);

    IF _pid IS NOT NULL THEN
      SELECT stock INTO _before FROM public.products WHERE id = _pid AND org_id = _org_id FOR UPDATE;
      IF _before IS NOT NULL THEN
        _after := _before + _qty;
        UPDATE public.products SET stock = _after,
               cost_price = CASE WHEN _cost > 0 THEN _cost ELSE cost_price END,
               updated_at = now()
        WHERE id = _pid;
        INSERT INTO public.stock_movements (org_id, product_id, product_name, type, qty, before_qty, after_qty, user_id, note)
        VALUES (_org_id, _pid, _name, 'in', _qty, _before, _after, _uid, 'purchase ' || _pid_out::text);
      END IF;
    END IF;
  END LOOP;

  RETURN _pid_out;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_sale(
  _org_id uuid,
  _items jsonb,
  _discount numeric DEFAULT 0,
  _payment payment_method DEFAULT 'cash'::payment_method,
  _customer_id uuid DEFAULT NULL,
  _customer_name text DEFAULT NULL,
  _amount_paid numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _sale_id UUID;
  _subtotal NUMERIC(14,2) := 0;
  _profit NUMERIC(14,2) := 0;
  _total NUMERIC(14,2);
  _paid NUMERIC(14,2);
  _it JSONB;
  _pid UUID; _vid UUID; _qty NUMERIC; _price NUMERIC; _cost NUMERIC;
  _before NUMERIC; _after NUMERIC; _name TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_org_member(_uid, _org_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_it->>'qty')::NUMERIC;
    _price := (_it->>'price')::NUMERIC;
    _cost := COALESCE((_it->>'cost')::NUMERIC, 0);
    _subtotal := _subtotal + (_qty * _price);
    _profit := _profit + (_qty * (_price - _cost));
  END LOOP;

  _total := GREATEST(_subtotal - COALESCE(_discount,0), 0);
  _paid := LEAST(GREATEST(COALESCE(_amount_paid, _total), 0), _total);
  IF _payment <> 'credit'::payment_method THEN _paid := _total; END IF;

  INSERT INTO public.sales (org_id, subtotal, discount, total, profit, payment, customer_id, customer_name, cashier_id, amount_paid)
  VALUES (_org_id, _subtotal, COALESCE(_discount,0), _total, _profit, _payment, _customer_id, _customer_name, _uid, _paid)
  RETURNING id INTO _sale_id;

  IF _paid > 0 AND _payment = 'credit'::payment_method THEN
    INSERT INTO public.customer_payments (org_id, customer_id, sale_id, amount, method, note, user_id)
    VALUES (_org_id, _customer_id, _sale_id, _paid, 'cash', 'deposit at sale', _uid);
  END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _pid := NULLIF(_it->>'product_id','')::UUID;
    _vid := NULLIF(_it->>'variant_id','')::UUID;
    _name := _it->>'name';
    _qty := (_it->>'qty')::NUMERIC;
    _price := (_it->>'price')::NUMERIC;
    _cost := COALESCE((_it->>'cost')::NUMERIC, 0);

    INSERT INTO public.sale_items (sale_id, product_id, variant_id, name, qty, price, cost)
    VALUES (_sale_id, _pid, _vid, _name, _qty, _price, _cost);

    IF _vid IS NOT NULL THEN
      UPDATE public.product_variants SET stock = stock - _qty, updated_at = now()
      WHERE id = _vid AND org_id = _org_id;
    END IF;

    IF _pid IS NOT NULL THEN
      SELECT stock INTO _before FROM public.products WHERE id = _pid AND org_id = _org_id FOR UPDATE;
      IF _before IS NOT NULL THEN
        _after := _before - _qty;
        UPDATE public.products SET stock = _after WHERE id = _pid;
        INSERT INTO public.stock_movements (org_id, product_id, product_name, type, qty, before_qty, after_qty, user_id, note)
        VALUES (_org_id, _pid, _name, 'sale', _qty, _before, _after, _uid, 'sale ' || _sale_id::text);
      END IF;
    END IF;
  END LOOP;

  RETURN _sale_id;
END;
$function$;
