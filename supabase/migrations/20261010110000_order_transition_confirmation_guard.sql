-- Preserve the order state shown during confirmation and reject stale choices
-- inside the same transaction that claims idempotency and mutates the order.
alter table public.business_idempotency
  drop constraint if exists business_idempotency_operation_check;
alter table public.business_idempotency
  add constraint business_idempotency_operation_check check (operation in (
    'product.create', 'product.adjust', 'customer.create', 'khata.openAccount',
    'khata.addEntry', 'sale.record', 'supplier.create', 'order.createDraft',
    'order.transition', 'order.transition.confirmed'
  ));

create function public.transition_purchase_order_confirmed_idempotent(
  p_shop_id uuid,
  p_request_key uuid,
  p_order_id uuid,
  p_expected_status text,
  p_action text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_replay jsonb;
  v_current_status text;
  v_status text;
  v_payload jsonb;
begin
  if p_expected_status not in ('draft', 'placed', 'received', 'cancelled')
    or p_action not in ('place', 'receive', 'cancel') then
    raise exception 'Invalid purchase-order confirmation' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('orderId', p_order_id, 'expectedStatus', p_expected_status, 'action', p_action);
  v_replay := public.claim_business_idempotency(p_shop_id, p_request_key, 'order.transition.confirmed', v_payload);
  if v_replay is not null then return v_replay ->> 'status'; end if;

  select status into v_current_status from public.purchase_orders
  where id = p_order_id and shop_id = p_shop_id for update;
  if not found then raise exception 'Purchase order not found' using errcode = 'P0002'; end if;
  if v_current_status <> p_expected_status then
    raise exception 'Purchase order changed after confirmation was requested' using errcode = '40001';
  end if;

  v_status := public.transition_purchase_order(p_shop_id, p_order_id, p_action);
  update public.business_idempotency set response = jsonb_build_object('status', v_status)
  where shop_id = p_shop_id and request_key = p_request_key;
  return v_status;
end;
$$;

revoke execute on function public.transition_purchase_order_confirmed_idempotent(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.transition_purchase_order_confirmed_idempotent(uuid, uuid, uuid, text, text) to authenticated;
