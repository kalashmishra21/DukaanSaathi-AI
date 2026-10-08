-- Expand opt-in demo data without changing existing shops. Reset is owner-scoped
-- and atomic: a failed reseed rolls back the deletion in the same transaction.
create or replace function public.bootstrap_demo_shop() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := (select auth.uid());
  v_shop uuid;
  v_maggi uuid;
  v_parle uuid;
  v_salt uuid;
  v_milk uuid;
  v_surf uuid;
  v_atta uuid;
  v_tea uuid;
  v_biscuit uuid;
  v_customer uuid;
begin
  if v_owner is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select id into v_shop from public.shops
  where owner_id = v_owner and name = 'DukaanSaathi Demo Mart';
  if found then return v_shop; end if;

  insert into public.profiles(id) values (v_owner) on conflict (id) do nothing;
  insert into public.shops(owner_id, name) values (v_owner, 'DukaanSaathi Demo Mart')
  on conflict (owner_id, name) do update set name = excluded.name returning id into v_shop;
  if exists (select 1 from public.products where shop_id = v_shop) then return v_shop; end if;

  insert into public.products(shop_id, name, sku, unit, selling_price, cost_price, low_stock_threshold)
  values
    (v_shop, 'Maggi', 'MAG-001', 'packet', 15, 12, 10),
    (v_shop, 'Parle-G', 'PAR-001', 'packet', 10, 8, 12),
    (v_shop, 'Tata Salt', 'SAL-001', 'packet', 28, 24, 10),
    (v_shop, 'Amul Milk', 'MIL-001', 'pack', 34, 30, 10),
    (v_shop, 'Surf Excel', 'SUR-001', 'packet', 120, 105, 8),
    (v_shop, 'Aashirvaad Atta', 'ATT-001', 'bag', 335, 305, 6),
    (v_shop, 'Tata Tea', 'TEA-001', 'pack', 110, 94, 6),
    (v_shop, 'Good Day', 'BIS-001', 'packet', 30, 25, 8);

  select id into v_maggi from public.products where shop_id = v_shop and name = 'Maggi';
  select id into v_parle from public.products where shop_id = v_shop and name = 'Parle-G';
  select id into v_salt from public.products where shop_id = v_shop and name = 'Tata Salt';
  select id into v_milk from public.products where shop_id = v_shop and name = 'Amul Milk';
  select id into v_surf from public.products where shop_id = v_shop and name = 'Surf Excel';
  select id into v_atta from public.products where shop_id = v_shop and name = 'Aashirvaad Atta';
  select id into v_tea from public.products where shop_id = v_shop and name = 'Tata Tea';
  select id into v_biscuit from public.products where shop_id = v_shop and name = 'Good Day';

  perform public.adjust_stock(v_shop, v_maggi, 48, 'Demo opening stock');
  perform public.adjust_stock(v_shop, v_parle, 90, 'Demo opening stock');
  perform public.adjust_stock(v_shop, v_salt, 24, 'Demo opening stock');
  perform public.adjust_stock(v_shop, v_milk, 12, 'Demo opening stock');
  perform public.adjust_stock(v_shop, v_surf, 7, 'Demo opening stock');
  perform public.adjust_stock(v_shop, v_atta, 22, 'Demo opening stock');
  perform public.adjust_stock(v_shop, v_tea, 18, 'Demo opening stock');
  perform public.adjust_stock(v_shop, v_biscuit, 40, 'Demo opening stock');
  perform public.adjust_stock(v_shop, v_parle, 12, 'Demo supplier restock');
  perform public.adjust_stock(v_shop, v_salt, -2, 'Demo damaged stock correction');

  insert into public.customers(shop_id, name) values
    (v_shop, 'Rahul Sharma'), (v_shop, 'Priya Verma'),
    (v_shop, 'Amit Kumar'), (v_shop, 'Neha Shah');
  select id into v_customer from public.customers where shop_id = v_shop and name = 'Rahul Sharma';
  insert into public.khata_entries(shop_id, customer_id, type, amount, note) values
    (v_shop, v_customer, 'gave', 460, 'Demo groceries'),
    (v_shop, v_customer, 'received', 200, 'Demo payment'),
    (v_shop, v_customer, 'gave', 120, 'Demo household items'),
    (v_shop, v_customer, 'received', 80, 'Demo UPI payment');
  select id into v_customer from public.customers where shop_id = v_shop and name = 'Priya Verma';
  insert into public.khata_entries(shop_id, customer_id, type, amount, note) values
    (v_shop, v_customer, 'gave', 180, 'Demo groceries'),
    (v_shop, v_customer, 'received', 50, 'Demo part payment');
  select id into v_customer from public.customers where shop_id = v_shop and name = 'Amit Kumar';
  insert into public.khata_entries(shop_id, customer_id, type, amount, note) values
    (v_shop, v_customer, 'gave', 75, 'Demo purchase'),
    (v_shop, v_customer, 'received', 75, 'Demo settled');
  select id into v_customer from public.customers where shop_id = v_shop and name = 'Neha Shah';
  insert into public.khata_entries(shop_id, customer_id, type, amount, note)
  values (v_shop, v_customer, 'gave', 340, 'Demo monthly groceries');

  perform public.record_sale(v_shop, jsonb_build_array(
    jsonb_build_object('productId', v_maggi, 'quantity', 2),
    jsonb_build_object('productId', v_parle, 'quantity', 3)
  ), 'cash');
  perform public.record_sale(v_shop, jsonb_build_array(
    jsonb_build_object('productId', v_milk, 'quantity', 2),
    jsonb_build_object('productId', v_salt, 'quantity', 1)
  ), 'upi');
  perform public.record_sale(v_shop, jsonb_build_array(
    jsonb_build_object('productId', v_atta, 'quantity', 1),
    jsonb_build_object('productId', v_tea, 'quantity', 2)
  ), 'cash');
  perform public.record_sale(v_shop, jsonb_build_array(
    jsonb_build_object('productId', v_parle, 'quantity', 4),
    jsonb_build_object('productId', v_biscuit, 'quantity', 3)
  ), 'upi');
  return v_shop;
end;
$$;

create function public.reset_demo_shop() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := (select auth.uid());
  v_shop uuid;
begin
  if v_owner is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select id into v_shop from public.shops
  where owner_id = v_owner and name = 'DukaanSaathi Demo Mart' for update;
  if v_shop is null then raise exception 'Demo shop not found' using errcode = 'P0002'; end if;
  delete from public.shops where id = v_shop and owner_id = v_owner;
  return public.bootstrap_demo_shop();
end;
$$;

revoke execute on function public.reset_demo_shop() from public, anon;
grant execute on function public.reset_demo_shop() to authenticated;
