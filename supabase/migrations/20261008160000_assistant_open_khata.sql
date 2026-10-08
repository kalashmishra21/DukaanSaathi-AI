-- Creating an account and its opening ledger entry must be one transaction.
create function public.open_khata_account(p_shop_id uuid, p_name text, p_amount numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_customer_id uuid;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.shops where id = p_shop_id and owner_id = (select auth.uid())
  ) then raise exception 'Not authorized for this shop' using errcode = '42501'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120
    or p_amount is null or p_amount <= 0 or p_amount > 10000000
    or round(p_amount, 2) <> p_amount then
    raise exception 'Invalid opening account details' using errcode = '22023';
  end if;

  insert into public.customers(shop_id, name) values (p_shop_id, trim(p_name))
  returning id into v_customer_id;
  insert into public.khata_entries(shop_id, customer_id, type, amount, note)
  values (p_shop_id, v_customer_id, 'gave', p_amount, 'Opening balance');
  return v_customer_id;
end;
$$;

revoke execute on function public.open_khata_account(uuid, text, numeric) from public, anon;
grant execute on function public.open_khata_account(uuid, text, numeric) to authenticated;
