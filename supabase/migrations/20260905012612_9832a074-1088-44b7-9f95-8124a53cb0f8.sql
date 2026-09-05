-- 1. Remove the outdated 6-argument sale function. Two overloads existed, so
-- non-credit sales (which omit the deposit argument) became ambiguous and failed.
DROP FUNCTION IF EXISTS public.record_sale(uuid, jsonb, numeric, payment_method, uuid, text);

-- 2. Kitchen -> staff handover ledger
CREATE TABLE IF NOT EXISTS public.handovers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit TEXT,
  issued_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  received_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  sold_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  returned_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  staff_name TEXT NOT NULL,
  staff_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.handovers TO authenticated;
GRANT ALL ON public.handovers TO service_role;
ALTER TABLE public.handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "handovers_select" ON public.handovers FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "handovers_insert" ON public.handovers FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id) AND issued_by = auth.uid());
CREATE POLICY "handovers_update" ON public.handovers FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "handovers_delete" ON public.handovers FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id));

CREATE INDEX IF NOT EXISTS handovers_org_created_idx ON public.handovers (org_id, created_at DESC);

CREATE TRIGGER handovers_updated BEFORE UPDATE ON public.handovers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Branch-to-branch stock transfers
CREATE TABLE IF NOT EXISTS public.store_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  to_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit TEXT,
  qty NUMERIC(14,3) NOT NULL,
  cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  price NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_transfers TO authenticated;
GRANT ALL ON public.store_transfers TO service_role;
ALTER TABLE public.store_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfers_select" ON public.store_transfers FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), from_org_id) OR public.is_org_member(auth.uid(), to_org_id));
CREATE POLICY "transfers_insert" ON public.store_transfers FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), from_org_id) AND created_by = auth.uid());
CREATE POLICY "transfers_update" ON public.store_transfers FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), from_org_id) OR public.is_org_member(auth.uid(), to_org_id))
  WITH CHECK (public.is_org_member(auth.uid(), from_org_id) OR public.is_org_member(auth.uid(), to_org_id));

CREATE INDEX IF NOT EXISTS transfers_from_idx ON public.store_transfers (from_org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transfers_to_idx ON public.store_transfers (to_org_id, created_at DESC);

-- 4. Transfer RPCs (stock is moved atomically and logged in stock_movements)
CREATE OR REPLACE FUNCTION public.create_store_transfer(
  _from_org_id UUID,
  _to_org_id UUID,
  _product_id UUID,
  _qty NUMERIC,
  _note TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid UUID := auth.uid();
  _p RECORD;
  _before NUMERIC;
  _after NUMERIC;
  _id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_org_member(_uid, _from_org_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _qty IS NULL OR _qty <= 0 THEN RAISE EXCEPTION 'quantity must be greater than zero'; END IF;
  IF _from_org_id = _to_org_id THEN RAISE EXCEPTION 'source and destination must differ'; END IF;

  SELECT * INTO _p FROM public.products WHERE id = _product_id AND org_id = _from_org_id FOR UPDATE;
  IF _p IS NULL THEN RAISE EXCEPTION 'product not found in source store'; END IF;
  IF _p.stock < _qty THEN RAISE EXCEPTION 'not enough stock'; END IF;

  _before := _p.stock;
  _after := _before - _qty;
  UPDATE public.products SET stock = _after, updated_at = now() WHERE id = _product_id;

  INSERT INTO public.stock_movements (org_id, product_id, product_name, type, qty, before_qty, after_qty, user_id, note)
  VALUES (_from_org_id, _product_id, _p.name, 'out', _qty, _before, _after, _uid, COALESCE(_note, 'transfer out'));

  INSERT INTO public.store_transfers (from_org_id, to_org_id, product_id, product_name, unit, qty, cost, price, note, created_by)
  VALUES (_from_org_id, _to_org_id, _product_id, _p.name, _p.unit, _qty, _p.cost_price, _p.price, _note, _uid)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.receive_store_transfer(_transfer_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid UUID := auth.uid();
  _t RECORD;
  _dest UUID;
  _before NUMERIC;
  _after NUMERIC;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _t FROM public.store_transfers WHERE id = _transfer_id FOR UPDATE;
  IF _t IS NULL THEN RAISE EXCEPTION 'transfer not found'; END IF;
  IF _t.status <> 'pending' THEN RAISE EXCEPTION 'transfer already %', _t.status; END IF;
  IF NOT public.is_org_member(_uid, _t.to_org_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT id INTO _dest FROM public.products
   WHERE org_id = _t.to_org_id AND lower(name) = lower(_t.product_name) LIMIT 1;

  IF _dest IS NULL THEN
    INSERT INTO public.products (org_id, name, category, cost_price, price, stock, min_stock, unit)
    VALUES (_t.to_org_id, _t.product_name, 'Transfers', _t.cost, _t.price, 0, 0, _t.unit)
    RETURNING id INTO _dest;
  END IF;

  SELECT stock INTO _before FROM public.products WHERE id = _dest FOR UPDATE;
  _after := _before + _t.qty;
  UPDATE public.products SET stock = _after, updated_at = now() WHERE id = _dest;

  INSERT INTO public.stock_movements (org_id, product_id, product_name, type, qty, before_qty, after_qty, user_id, note)
  VALUES (_t.to_org_id, _dest, _t.product_name, 'in', _t.qty, _before, _after, _uid, 'transfer in');

  UPDATE public.store_transfers
     SET status = 'received', received_by = _uid, received_at = now()
   WHERE id = _transfer_id;

  RETURN _dest;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_store_transfer(_transfer_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid UUID := auth.uid();
  _t RECORD;
  _before NUMERIC;
  _after NUMERIC;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _t FROM public.store_transfers WHERE id = _transfer_id FOR UPDATE;
  IF _t IS NULL THEN RAISE EXCEPTION 'transfer not found'; END IF;
  IF _t.status <> 'pending' THEN RAISE EXCEPTION 'transfer already %', _t.status; END IF;
  IF NOT public.is_org_member(_uid, _t.from_org_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _t.product_id IS NOT NULL THEN
    SELECT stock INTO _before FROM public.products WHERE id = _t.product_id FOR UPDATE;
    IF _before IS NOT NULL THEN
      _after := _before + _t.qty;
      UPDATE public.products SET stock = _after, updated_at = now() WHERE id = _t.product_id;
      INSERT INTO public.stock_movements (org_id, product_id, product_name, type, qty, before_qty, after_qty, user_id, note)
      VALUES (_t.from_org_id, _t.product_id, _t.product_name, 'in', _t.qty, _before, _after, _uid, 'transfer cancelled');
    END IF;
  END IF;

  UPDATE public.store_transfers SET status = 'cancelled' WHERE id = _transfer_id;
END;
$$;
