-- Owner-scoped supplier directory and internal purchase orders. Placing an order
-- records intent in the shop; it does not contact a supplier. Receiving is atomic.
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  contact_name text check (contact_name is null or length(trim(contact_name)) between 1 and 120),
  phone text check (phone is null or length(trim(phone)) between 6 and 20),
  created_at timestamptz not null default now(),
  unique (id, shop_id)
);
create unique index suppliers_shop_name_unique on public.suppliers(shop_id, lower(name));

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  supplier_id uuid not null,
  status text not null default 'draft' check (status in ('draft', 'placed', 'received', 'cancelled')),
  note text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, shop_id),
  foreign key (supplier_id, shop_id) references public.suppliers(id, shop_id)
);
create index purchase_orders_shop_created on public.purchase_orders(shop_id, created_at desc);
create index purchase_orders_supplier_shop on public.purchase_orders(supplier_id, shop_id);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid not null,
  product_id uuid not null,
  quantity integer not null check (quantity between 1 and 10000),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  foreign key (order_id, shop_id) references public.purchase_orders(id, shop_id) on delete cascade,
  foreign key (product_id, shop_id) references public.products(id, shop_id)
);
create index purchase_order_items_order_shop on public.purchase_order_items(order_id, shop_id);
create index purchase_order_items_product_shop on public.purchase_order_items(product_id, shop_id);

alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
create policy suppliers_owner on public.suppliers for all to authenticated
using (shop_id in (select id from public.shops where owner_id = (select auth.uid())))
with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy purchase_orders_owner on public.purchase_orders for all to authenticated
using (shop_id in (select id from public.shops where owner_id = (select auth.uid())))
with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy purchase_order_items_owner on public.purchase_order_items for all to authenticated
using (shop_id in (select id from public.shops where owner_id = (select auth.uid())))
with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));

create function public.create_purchase_order(p_shop_id uuid, p_supplier_id uuid, p_items jsonb, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_order_id uuid; v_item jsonb; v_product_id uuid; v_quantity integer; v_cost numeric(12,2); v_seen uuid[] := '{}';
begin
  if (select auth.uid()) is null or not exists (select 1 from public.shops where id = p_shop_id and owner_id = (select auth.uid())) then
    raise exception 'Not authorized for this shop' using errcode = '42501';
  end if;
  if not exists (select 1 from public.suppliers where id = p_supplier_id and shop_id = p_shop_id) then
    raise exception 'Supplier not found' using errcode = 'P0002';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30
    or length(coalesce(p_note, '')) > 300 then
    raise exception 'Invalid purchase order' using errcode = '22023';
  end if;
  insert into public.purchase_orders(shop_id, supplier_id, note)
  values (p_shop_id, p_supplier_id, nullif(trim(p_note), '')) returning id into v_order_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'productId') <> 'string'
      or jsonb_typeof(v_item -> 'quantity') <> 'number' or (v_item ->> 'quantity') !~ '^[0-9]+$'
      or jsonb_typeof(v_item -> 'unitCost') not in ('number', 'null') then
      raise exception 'Invalid purchase order item' using errcode = '22023';
    end if;
    v_product_id := (v_item ->> 'productId')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity not between 1 and 10000 or v_product_id = any(v_seen) then
      raise exception 'Invalid or duplicate purchase item' using errcode = '22023';
    end if;
    v_seen := array_append(v_seen, v_product_id);
    select coalesce((v_item ->> 'unitCost')::numeric, cost_price, selling_price)
      into v_cost from public.products where id = v_product_id and shop_id = p_shop_id and archived_at is null;
    if not found then raise exception 'Product not found' using errcode = 'P0002'; end if;
    if v_cost < 0 or v_cost > 999999999 then raise exception 'Invalid unit cost' using errcode = '22023'; end if;
    insert into public.purchase_order_items(shop_id, order_id, product_id, quantity, unit_cost)
    values (p_shop_id, v_order_id, v_product_id, v_quantity, v_cost);
  end loop;
  return v_order_id;
end;
$$;

create function public.transition_purchase_order(p_shop_id uuid, p_order_id uuid, p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_order public.purchase_orders%rowtype; v_item record;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.shops where id = p_shop_id and owner_id = (select auth.uid())) then
    raise exception 'Not authorized for this shop' using errcode = '42501';
  end if;
  select * into v_order from public.purchase_orders where id = p_order_id and shop_id = p_shop_id for update;
  if not found then raise exception 'Purchase order not found' using errcode = 'P0002'; end if;
  if p_action = 'place' and v_order.status = 'draft' then
    update public.purchase_orders set status = 'placed', updated_at = now() where id = p_order_id;
    return 'placed';
  elsif p_action = 'cancel' and v_order.status in ('draft', 'placed') then
    update public.purchase_orders set status = 'cancelled', updated_at = now() where id = p_order_id;
    return 'cancelled';
  elsif p_action = 'receive' and v_order.status = 'placed' then
    for v_item in select product_id, quantity from public.purchase_order_items where order_id = p_order_id and shop_id = p_shop_id order by product_id loop
      perform public.adjust_stock(p_shop_id, v_item.product_id, v_item.quantity, 'Purchase order ' || p_order_id::text);
    end loop;
    update public.purchase_orders set status = 'received', updated_at = now() where id = p_order_id;
    return 'received';
  end if;
  raise exception 'Purchase order cannot make this transition' using errcode = '22023';
end;
$$;

-- Keep all order and item mutations behind validated atomic functions.
grant select, insert, update on public.suppliers to authenticated;
grant select on public.purchase_orders, public.purchase_order_items to authenticated;
revoke insert, update, delete on public.purchase_orders, public.purchase_order_items from public, anon, authenticated;
revoke execute on function public.create_purchase_order(uuid, uuid, jsonb, text) from public, anon;
revoke execute on function public.transition_purchase_order(uuid, uuid, text) from public, anon;
grant execute on function public.create_purchase_order(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.transition_purchase_order(uuid, uuid, text) to authenticated;

-- Demo-only supplier seed is synthetic and follows a shop through reset/reseed.
create function public.seed_demo_suppliers() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.name = 'DukaanSaathi Demo Mart' then
    insert into public.suppliers(shop_id, name, contact_name) values
      (new.id, 'North Market Distributors', 'Demo contact'),
      (new.id, 'Everyday Staples Supply', 'Demo contact')
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.seed_demo_suppliers() from public, anon, authenticated;
create trigger demo_suppliers_on_shop after insert on public.shops
for each row execute function public.seed_demo_suppliers();
insert into public.suppliers(shop_id, name, contact_name)
select id, 'North Market Distributors', 'Demo contact' from public.shops where name = 'DukaanSaathi Demo Mart'
on conflict do nothing;
insert into public.suppliers(shop_id, name, contact_name)
select id, 'Everyday Staples Supply', 'Demo contact' from public.shops where name = 'DukaanSaathi Demo Mart'
on conflict do nothing;
