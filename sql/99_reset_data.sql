-- ZPoS — Futa data zote (schema inabaki). Tumia kwa tahadhari!
-- Haifuti watumiaji wa Auth wala roles za super_admin.

TRUNCATE TABLE
  public.sale_items,
  public.sales,
  public.purchase_items,
  public.purchases,
  public.customer_payments,
  public.stock_movements,
  public.product_variants,
  public.products,
  public.customers,
  public.suppliers,
  public.expenses,
  public.employees,
  public.zpos_cloud_backups
RESTART IDENTITY CASCADE;

-- Futa maduka yote pamoja na roles za owner/cashier (super_admin inabaki).
DELETE FROM public.user_roles WHERE org_id IS NOT NULL;
DELETE FROM public.organizations;
