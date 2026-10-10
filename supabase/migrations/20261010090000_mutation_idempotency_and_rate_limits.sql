-- Durable owner-scoped replay protection and distributed API quotas.
-- Each idempotency claim and its business write live in the same Postgres
-- transaction. Failed writes roll back the claim, so the same request can be
-- corrected/retried without leaving a false completion record.

create table public.business_idempotency (
  shop_id uuid not null references public.shops(id) on delete cascade,
  request_key uuid not null,
  operation text not null check (operation in (
    'product.create', 'product.adjust', 'customer.create', 'khata.openAccount',
    'khata.addEntry', 'sale.record', 'supplier.create', 'order.createDraft',
    'order.transition'
  )),
  payload jsonb not null,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (shop_id, request_key)
);

alter table public.business_idempotency enable row level security;
revoke all on public.business_idempotency from public, anon, authenticated;

create function public.claim_business_idempotency(
  p_shop_id uuid, p_request_key uuid, p_operation text, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_operation text;
  v_payload jsonb;
  v_response jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.shops where id = p_shop_id and owner_id = (select auth.uid())
  ) then
    raise exception 'Not authorized for this shop' using errcode = '42501';
  end if;
  if p_request_key is null or p_payload is null then
    raise exception 'A request key and payload are required' using errcode = '22023';
  end if;

  insert into public.business_idempotency(shop_id, request_key, operation, payload)
  values (p_shop_id, p_request_key, p_operation, p_payload)
  on conflict (shop_id, request_key) do nothing;

  select operation, payload, response into v_operation, v_payload, v_response
  from public.business_idempotency
  where shop_id = p_shop_id and request_key = p_request_key
  for update;

  if v_operation <> p_operation or v_payload <> p_payload then
    raise exception 'Idempotency key was already used for a different request' using errcode = '22023';
  end if;
  return v_response;
end;
$$;

create function public.create_product_idempotent(
  p_shop_id uuid, p_request_key uuid, p_name text, p_sku text, p_unit text,
  p_selling_price numeric, p_cost_price numeric, p_threshold integer, p_opening_stock integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_replay jsonb; v_id uuid; v_result jsonb;
begin
  v_result := jsonb_build_object('name', p_name, 'sku', p_sku, 'unit', p_unit,
    'sellingPrice', p_selling_price, 'costPrice', p_cost_price,
    'threshold', p_threshold, 'openingStock', p_opening_stock);
  v_replay := public.claim_business_idempotency(p_shop_id, p_request_key, 'product.create', v_result);
  if v_replay is not null then return (v_replay ->> 'id')::uuid; end if;
  v_id := public.create_product(p_shop_id, p_name, p_sku, p_unit, p_selling_price,
    p_cost_price, p_threshold, p_opening_stock);
  update public.business_idempotency set response = jsonb_build_object('id', v_id)
  where shop_id = p_shop_id and request_key = p_request_key;
  return v_id;
end;
$$;

create function public.adjust_stock_idempotent(
  p_shop_id uuid, p_request_key uuid, p_product_id uuid, p_delta integer, p_note text default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare v_replay jsonb; v_stock integer; v_payload jsonb;
begin
  v_payload := jsonb_build_object('productId', p_product_id, 'delta', p_delta, 'note', p_note);
  v_replay := public.claim_business_idempotency(p_shop_id, p_request_key, 'product.adjust', v_payload);
  if v_replay is not null then return (v_replay ->> 'stock')::integer; end if;
  v_stock := public.adjust_stock(p_shop_id, p_product_id, p_delta, p_note);
  update public.business_idempotency set response = jsonb_build_object('stock', v_stock)
  where shop_id = p_shop_id and request_key = p_request_key;
  return v_stock;
end;
$$;

create function public.create_customer_idempotent(
  p_shop_id uuid, p_request_key uuid, p_name text, p_phone text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_replay jsonb; v_id uuid; v_payload jsonb;
begin
  v_payload := jsonb_build_object('name', p_name, 'phone', p_phone);
  v_replay := public.claim_business_idempotency(p_shop_id, p_request_key, 'customer.create', v_payload);
  if v_replay is not null then return (v_replay ->> 'id')::uuid; end if;
  insert into public.customers(shop_id, name, phone) values (p_shop_id, trim(p_name), nullif(trim(p_phone), ''))
  returning id into v_id;
  update public.business_idempotency set response = jsonb_build_object('id', v_id)
  where shop_id = p_shop_id and request_key = p_request_key;
  return v_id;
end;
$$;

create function public.open_khata_account_idempotent(
  p_shop_id uuid, p_request_key uuid, p_name text, p_amount numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_replay jsonb; v_id uuid; v_payload jsonb;
begin
  v_payload := jsonb_build_object('name', p_name, 'amount', p_amount);
  v_replay := public.claim_business_idempotency(p_shop_id, p_request_key, 'khata.openAccount', v_payload);
  if v_replay is not null then return (v_replay ->> 'id')::uuid; end if;
  v_id := public.open_khata_account(p_shop_id, p_name, p_amount);
  update public.business_idempotency set response = jsonb_build_object('id', v_id)
  where shop_id = p_shop_id and request_key = p_request_key;
  return v_id;
end;
$$;

create function public.add_khata_entry_idempotent(
  p_shop_id uuid, p_request_key uuid, p_customer_id uuid,
  p_type text, p_amount numeric, p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_replay jsonb; v_id uuid; v_payload jsonb;
begin
  v_payload := jsonb_build_object('customerId', p_customer_id, 'type', p_type,
    'amount', p_amount, 'note', p_note);
  v_replay := public.claim_business_idempotency(p_shop_id, p_request_key, 'khata.addEntry', v_payload);
  if v_replay is not null then return (v_replay ->> 'id')::uuid; end if;
  if not exists (select 1 from public.customers where id = p_customer_id and shop_id = p_shop_id) then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
  if p_type not in ('gave', 'received') or p_amount <= 0 or p_amount > 999999999 then
    raise exception 'Invalid khata entry' using errcode = '22023';
  end if;
  insert into public.khata_entries(shop_id, customer_id, type, amount, note)
  values (p_shop_id, p_customer_id, p_type, p_amount, nullif(trim(p_note), '')) returning id into v_id;
  update public.business_idempotency set response = jsonb_build_object('id', v_id)
  where shop_id = p_shop_id and request_key = p_request_key;
  return v_id;
end;
$$;

create function public.record_sale_idempotent(
  p_shop_id uuid, p_request_key uuid, p_items jsonb, p_payment_method text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_replay jsonb; v_sale_id uuid; v_total numeric(12,2); v_payload jsonb;
begin
  v_payload := jsonb_build_object('items', p_items, 'paymentMethod', p_payment_method);
  v_replay := public.claim_business_idempotency(p_shop_id, p_request_key, 'sale.record', v_payload);
  if v_replay is not null then return v_replay; end if;
  v_sale_id := public.record_sale(p_shop_id, p_items, p_payment_method);
  select total_amount into v_total from public.sales where id = v_sale_id and shop_id = p_shop_id;
  if not found then raise exception 'Recorded sale could not be verified' using errcode = 'P0001'; end if;
  v_replay := jsonb_build_object('saleId', v_sale_id, 'total', v_total);
  update public.business_idempotency set response = v_replay
  where shop_id = p_shop_id and request_key = p_request_key;
  return v_replay;
end;
$$;

create function public.create_supplier_idempotent(
  p_shop_id uuid, p_request_key uuid, p_name text, p_contact_name text default null, p_phone text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_replay jsonb; v_id uuid; v_payload jsonb;
begin
  v_payload := jsonb_build_object('name', p_name, 'contactName', p_contact_name, 'phone', p_phone);
  v_replay := public.claim_business_idempotency(p_shop_id, p_request_key, 'supplier.create', v_payload);
  if v_replay is not null then return (v_replay ->> 'id')::uuid; end if;
  insert into public.suppliers(shop_id, name, contact_name, phone)
  values (p_shop_id, trim(p_name), nullif(trim(p_contact_name), ''), nullif(trim(p_phone), ''))
  returning id into v_id;
  update public.business_idempotency set response = jsonb_build_object('id', v_id)
  where shop_id = p_shop_id and request_key = p_request_key;
  return v_id;
end;
$$;

create function public.create_purchase_order_idempotent(
  p_shop_id uuid, p_request_key uuid, p_supplier_id uuid, p_items jsonb, p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_replay jsonb; v_id uuid; v_payload jsonb;
begin
  v_payload := jsonb_build_object('supplierId', p_supplier_id, 'items', p_items, 'note', p_note);
  v_replay := public.claim_business_idempotency(p_shop_id, p_request_key, 'order.createDraft', v_payload);
  if v_replay is not null then return (v_replay ->> 'id')::uuid; end if;
  v_id := public.create_purchase_order(p_shop_id, p_supplier_id, p_items, p_note);
  update public.business_idempotency set response = jsonb_build_object('id', v_id)
  where shop_id = p_shop_id and request_key = p_request_key;
  return v_id;
end;
$$;

create function public.transition_purchase_order_idempotent(
  p_shop_id uuid, p_request_key uuid, p_order_id uuid, p_action text
) returns text language plpgsql security definer set search_path = '' as $$
declare v_replay jsonb; v_status text; v_payload jsonb;
begin
  v_payload := jsonb_build_object('orderId', p_order_id, 'action', p_action);
  v_replay := public.claim_business_idempotency(p_shop_id, p_request_key, 'order.transition', v_payload);
  if v_replay is not null then return v_replay ->> 'status'; end if;
  v_status := public.transition_purchase_order(p_shop_id, p_order_id, p_action);
  update public.business_idempotency set response = jsonb_build_object('status', v_status)
  where shop_id = p_shop_id and request_key = p_request_key;
  return v_status;
end;
$$;

-- One row per owner, shop/user scope and endpoint keeps rate-limit storage
-- bounded while atomically counting requests across app instances.
create table public.api_rate_limit_windows (
  owner_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete cascade,
  scope_key text not null,
  bucket text not null check (bucket in (
    'assistant_turn', 'assistant_speech', 'assistant_attachment', 'gnani_transcribe',
    'openrouter_reasoner', 'openrouter_vision', 'business_action'
  )),
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (owner_id, scope_key, bucket)
);
alter table public.api_rate_limit_windows enable row level security;
revoke all on public.api_rate_limit_windows from public, anon, authenticated;

create function public.consume_shop_rate_limit(p_shop_id uuid, p_bucket text)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := (select auth.uid());
  v_scope text;
  v_limit integer;
  v_window_seconds integer := 60;
  v_window_start timestamptz;
  v_count integer;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_shop_id is not null and not exists (
    select 1 from public.shops where id = p_shop_id and owner_id = v_owner
  ) then raise exception 'Not authorized for this shop' using errcode = '42501'; end if;

  v_limit := case p_bucket
    when 'assistant_turn' then 20
    when 'assistant_speech' then 8
    when 'assistant_attachment' then 4
    when 'gnani_transcribe' then 12
    when 'openrouter_reasoner' then 20
    when 'openrouter_vision' then 4
    when 'business_action' then 40
    else null
  end;
  if v_limit is null then raise exception 'Unknown rate limit bucket' using errcode = '22023'; end if;
  v_scope := case when p_shop_id is null then 'user:' || v_owner::text else 'shop:' || p_shop_id::text end;
  v_window_start := to_timestamp(floor(extract(epoch from clock_timestamp()) / v_window_seconds) * v_window_seconds);

  insert into public.api_rate_limit_windows(owner_id, shop_id, scope_key, bucket, window_start, request_count)
  values (v_owner, p_shop_id, v_scope, p_bucket, v_window_start, 1)
  on conflict (owner_id, scope_key, bucket) do update set
    shop_id = excluded.shop_id,
    window_start = excluded.window_start,
    request_count = case
      when public.api_rate_limit_windows.window_start = excluded.window_start
        then public.api_rate_limit_windows.request_count + 1
      else 1
    end
  returning request_count into v_count;

  return query select v_count <= v_limit,
    greatest(1, ceil(extract(epoch from (v_window_start + make_interval(secs => v_window_seconds) - clock_timestamp())))::integer);
end;
$$;

revoke execute on function public.claim_business_idempotency(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.create_product_idempotent(uuid, uuid, text, text, text, numeric, numeric, integer, integer) from public, anon;
revoke execute on function public.adjust_stock_idempotent(uuid, uuid, uuid, integer, text) from public, anon;
revoke execute on function public.create_customer_idempotent(uuid, uuid, text, text) from public, anon;
revoke execute on function public.open_khata_account_idempotent(uuid, uuid, text, numeric) from public, anon;
revoke execute on function public.add_khata_entry_idempotent(uuid, uuid, uuid, text, numeric, text) from public, anon;
revoke execute on function public.record_sale_idempotent(uuid, uuid, jsonb, text) from public, anon;
revoke execute on function public.create_supplier_idempotent(uuid, uuid, text, text, text) from public, anon;
revoke execute on function public.create_purchase_order_idempotent(uuid, uuid, uuid, jsonb, text) from public, anon;
revoke execute on function public.transition_purchase_order_idempotent(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.consume_shop_rate_limit(uuid, text) from public, anon;

grant execute on function public.create_product_idempotent(uuid, uuid, text, text, text, numeric, numeric, integer, integer) to authenticated;
grant execute on function public.adjust_stock_idempotent(uuid, uuid, uuid, integer, text) to authenticated;
grant execute on function public.create_customer_idempotent(uuid, uuid, text, text) to authenticated;
grant execute on function public.open_khata_account_idempotent(uuid, uuid, text, numeric) to authenticated;
grant execute on function public.add_khata_entry_idempotent(uuid, uuid, uuid, text, numeric, text) to authenticated;
grant execute on function public.record_sale_idempotent(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.create_supplier_idempotent(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.create_purchase_order_idempotent(uuid, uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.transition_purchase_order_idempotent(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.consume_shop_rate_limit(uuid, text) to authenticated;
