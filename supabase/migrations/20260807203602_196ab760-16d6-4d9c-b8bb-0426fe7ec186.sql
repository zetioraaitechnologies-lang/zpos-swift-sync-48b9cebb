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