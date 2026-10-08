-- DukaanSaathi: one owner per shop. Money is INR decimal(12,2).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  currency text not null default 'INR' check (currency = 'INR'),
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  sku text,
  unit text not null default 'piece' check (length(trim(unit)) between 1 and 40),
  selling_price numeric(12,2) not null check (selling_price >= 0),
  cost_price numeric(12,2) check (cost_price >= 0),
  current_stock integer not null default 0 check (current_stock >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, shop_id)
);
create unique index products_shop_name_unique on public.products (shop_id, lower(name)) where archived_at is null;
create unique index products_shop_sku_unique on public.products (shop_id, sku) where sku is not null and archived_at is null;

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null,
  movement_type text not null check (movement_type in ('restock', 'adjustment', 'sale')),
  quantity_delta integer not null check (quantity_delta <> 0),
  note text,
  created_at timestamptz not null default now(),
  foreign key (product_id, shop_id) references public.products(id, shop_id) on delete cascade
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  phone text check (phone is null or length(trim(phone)) between 6 and 20),
  created_at timestamptz not null default now(),
  unique (id, shop_id)
);
create unique index customers_shop_name_unique on public.customers (shop_id, lower(name));

create table public.khata_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null,
  type text not null check (type in ('gave', 'received')),
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now(),
  foreign key (customer_id, shop_id) references public.customers(id, shop_id) on delete cascade
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  payment_method text check (payment_method in ('cash', 'upi', 'card')),
  created_at timestamptz not null default now(),
  unique (id, shop_id)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  sale_id uuid not null,
  product_id uuid not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  foreign key (sale_id, shop_id) references public.sales(id, shop_id) on delete cascade,
  foreign key (product_id, shop_id) references public.products(id, shop_id)
);

create table public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  intent text not null,
  arguments jsonb not null check (jsonb_typeof(arguments) = 'object'),
  status text not null check (status in ('proposed', 'succeeded', 'failed')),
  created_at timestamptz not null default now()
);

create index inventory_movements_shop_created on public.inventory_movements(shop_id, created_at desc);
create index khata_entries_customer_created on public.khata_entries(customer_id, created_at desc);
create index sales_shop_created on public.sales(shop_id, created_at desc);

create function public.touch_product_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger products_updated_at before update on public.products
for each row execute function public.touch_product_updated_at();

create function public.protect_product_stock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.archived_at is null and new.archived_at is not null and new.current_stock <> 0 then
    raise exception 'Reduce stock to zero before archiving' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.archived_at is not null and new.archived_at is null and current_user <> 'postgres' then
    raise exception 'Archived products cannot be restored through the Data API' using errcode = '42501';
  end if;
  if current_user <> 'postgres' and (
    (tg_op = 'INSERT' and new.current_stock <> 0)
    or (tg_op = 'UPDATE' and new.current_stock is distinct from old.current_stock)
  ) then
    raise exception 'Use the trusted stock operation' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger products_protect_stock before insert or update on public.products
for each row execute function public.protect_product_stock();

create function public.create_profile_for_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.create_profile_for_user();

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.customers enable row level security;
alter table public.khata_entries enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.ai_actions enable row level security;

create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy shops_owner on public.shops for all to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy products_owner on public.products for all to authenticated
using (shop_id in (select id from public.shops where owner_id = (select auth.uid())))
with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy movements_owner on public.inventory_movements for all to authenticated
using (shop_id in (select id from public.shops where owner_id = (select auth.uid())))
with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy customers_owner on public.customers for all to authenticated
using (shop_id in (select id from public.shops where owner_id = (select auth.uid())))
with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy khata_owner on public.khata_entries for all to authenticated
using (shop_id in (select id from public.shops where owner_id = (select auth.uid())))
with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy sales_owner on public.sales for all to authenticated
using (shop_id in (select id from public.shops where owner_id = (select auth.uid())))
with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy sale_items_owner on public.sale_items for all to authenticated
using (shop_id in (select id from public.shops where owner_id = (select auth.uid())))
with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));
create policy ai_actions_owner on public.ai_actions for all to authenticated
using (shop_id in (select id from public.shops where owner_id = (select auth.uid())))
with check (shop_id in (select id from public.shops where owner_id = (select auth.uid())));

-- These functions are single database transactions. Ownership is checked inside
-- every security-definer function, and no function accepts a caller-supplied owner.
create function public.adjust_stock(p_shop_id uuid, p_product_id uuid, p_delta integer, p_note text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_stock integer;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.shops where id = p_shop_id and owner_id = (select auth.uid())
  ) then raise exception 'Not authorized for this shop' using errcode = '42501'; end if;
  if p_delta is null or p_delta = 0 or abs(p_delta::bigint) > 100000 then
    raise exception 'Stock adjustment must be between -100000 and 100000, excluding zero' using errcode = '22023';
  end if;
  update public.products set current_stock = current_stock + p_delta
  where id = p_product_id and shop_id = p_shop_id and archived_at is null and current_stock + p_delta >= 0
  returning current_stock into v_stock;
  if not found then
    raise exception 'Product missing or insufficient stock' using errcode = 'P0001';
  end if;
  insert into public.inventory_movements(shop_id, product_id, movement_type, quantity_delta, note)
  values (p_shop_id, p_product_id, case when p_delta > 0 then 'restock' else 'adjustment' end, p_delta, nullif(trim(p_note), ''));
  return v_stock;
end;
$$;

create function public.create_product(
  p_shop_id uuid, p_name text, p_sku text, p_unit text,
  p_selling_price numeric, p_cost_price numeric, p_threshold integer, p_opening_stock integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.shops where id = p_shop_id and owner_id = (select auth.uid())
  ) then raise exception 'Not authorized for this shop' using errcode = '42501'; end if;
  if p_opening_stock is null or p_opening_stock not between 0 and 100000 then
    raise exception 'Invalid opening stock' using errcode = '22023';
  end if;
  insert into public.products(shop_id, name, sku, unit, selling_price, cost_price, low_stock_threshold)
  values (p_shop_id, trim(p_name), nullif(trim(p_sku), ''), trim(p_unit), p_selling_price, p_cost_price, p_threshold)
  returning id into v_id;
  if p_opening_stock > 0 then
    perform public.adjust_stock(p_shop_id, v_id, p_opening_stock, 'Opening stock');
  end if;
  return v_id;
end;
$$;

create function public.record_sale(p_shop_id uuid, p_items jsonb, p_payment_method text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_product_id uuid;
  v_quantity integer;
  v_seen uuid[] := '{}';
  v_sale_id uuid;
  v_total numeric(12,2) := 0;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.shops where id = p_shop_id and owner_id = (select auth.uid())
  ) then raise exception 'Not authorized for this shop' using errcode = '42501'; end if;
  if p_payment_method is not null and p_payment_method not in ('cash', 'upi', 'card') then
    raise exception 'Invalid payment method' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'Choose between 1 and 30 sale items' using errcode = '22023';
  end if;
  insert into public.sales(shop_id, total_amount, payment_method)
  values (p_shop_id, 0, p_payment_method) returning id into v_sale_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
      or jsonb_typeof(v_item -> 'productId') <> 'string'
      or jsonb_typeof(v_item -> 'quantity') <> 'number'
      or (v_item ->> 'quantity') !~ '^[0-9]+$' then
      raise exception 'Invalid sale item' using errcode = '22023';
    end if;
    v_product_id := (v_item ->> 'productId')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity not between 1 and 10000 or v_product_id = any(v_seen) then
      raise exception 'Invalid or duplicate sale item' using errcode = '22023';
    end if;
    v_seen := array_append(v_seen, v_product_id);
    select * into v_product from public.products
    where id = v_product_id and shop_id = p_shop_id and archived_at is null for update;
    if not found then raise exception 'Product not found' using errcode = 'P0002'; end if;
    if v_product.current_stock < v_quantity then
      raise exception 'Insufficient stock for %', v_product.name using errcode = 'P0001';
    end if;
    update public.products set current_stock = current_stock - v_quantity where id = v_product_id;
    insert into public.sale_items(shop_id, sale_id, product_id, quantity, unit_price, line_total)
    values (p_shop_id, v_sale_id, v_product_id, v_quantity, v_product.selling_price, v_quantity * v_product.selling_price);
    insert into public.inventory_movements(shop_id, product_id, movement_type, quantity_delta, note)
    values (p_shop_id, v_product_id, 'sale', -v_quantity, 'Sale ' || v_sale_id::text);
    v_total := v_total + v_quantity * v_product.selling_price;
  end loop;
  update public.sales set total_amount = v_total where id = v_sale_id;
  return v_sale_id;
end;
$$;

-- A repeatable, opt-in seed for the signed-in owner's demo shop.
create function public.bootstrap_demo_shop() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := (select auth.uid());
  v_shop uuid;
  v_maggi uuid;
  v_parle uuid;
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
    (v_shop, 'Surf Excel', 'SUR-001', 'packet', 120, 105, 8);
  select id into v_maggi from public.products where shop_id = v_shop and name = 'Maggi';
  select id into v_parle from public.products where shop_id = v_shop and name = 'Parle-G';
  perform public.adjust_stock(v_shop, v_maggi, 48, 'Demo opening stock');
  perform public.adjust_stock(v_shop, v_parle, 90, 'Demo opening stock');
  perform public.adjust_stock(v_shop, (select id from public.products where shop_id = v_shop and name = 'Tata Salt'), 14, 'Demo opening stock');
  perform public.adjust_stock(v_shop, (select id from public.products where shop_id = v_shop and name = 'Amul Milk'), 8, 'Demo opening stock');
  perform public.adjust_stock(v_shop, (select id from public.products where shop_id = v_shop and name = 'Surf Excel'), 5, 'Demo opening stock');
  insert into public.customers(shop_id, name) values
    (v_shop, 'Rahul Sharma'), (v_shop, 'Priya Verma'), (v_shop, 'Amit Kumar');
  select id into v_customer from public.customers where shop_id = v_shop and name = 'Rahul Sharma';
  insert into public.khata_entries(shop_id, customer_id, type, amount, note) values
    (v_shop, v_customer, 'gave', 460, 'Demo groceries'),
    (v_shop, v_customer, 'received', 200, 'Demo payment');
  select id into v_customer from public.customers where shop_id = v_shop and name = 'Priya Verma';
  insert into public.khata_entries(shop_id, customer_id, type, amount, note)
  values (v_shop, v_customer, 'gave', 180, 'Demo groceries');
  perform public.record_sale(v_shop, jsonb_build_array(
    jsonb_build_object('productId', v_maggi, 'quantity', 2),
    jsonb_build_object('productId', v_parle, 'quantity', 3)
  ), 'cash');
  return v_shop;
end;
$$;

revoke execute on function public.adjust_stock(uuid, uuid, integer, text) from public, anon;
revoke execute on function public.create_product(uuid, text, text, text, numeric, numeric, integer, integer) from public, anon;
revoke execute on function public.record_sale(uuid, jsonb, text) from public, anon;
revoke execute on function public.bootstrap_demo_shop() from public, anon;
grant execute on function public.adjust_stock(uuid, uuid, integer, text) to authenticated;
grant execute on function public.create_product(uuid, text, text, text, numeric, numeric, integer, integer) to authenticated;
grant execute on function public.record_sale(uuid, jsonb, text) to authenticated;
grant execute on function public.bootstrap_demo_shop() to authenticated;

-- Owner-scoped reads remain available; stock and sales writes use the atomic
-- functions above. This also prevents direct Data API calls from fabricating sales.
revoke insert, update, delete on public.inventory_movements, public.sales, public.sale_items, public.ai_actions
from public, anon, authenticated;
