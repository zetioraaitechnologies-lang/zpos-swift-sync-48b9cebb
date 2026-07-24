
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
