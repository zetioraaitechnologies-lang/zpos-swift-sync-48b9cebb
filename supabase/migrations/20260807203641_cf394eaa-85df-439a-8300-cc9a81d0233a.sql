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