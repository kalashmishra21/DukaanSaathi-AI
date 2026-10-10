-- Persist one short-lived, owner-scoped Assistant clarification per shop.
-- This stores structured context only; it cannot execute or authorize a write.
create table public.assistant_pending_clarifications (
  owner_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  pending jsonb not null check (jsonb_typeof(pending) = 'object' and length(pending::text) <= 8192),
  request_key uuid not null,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (owner_id, shop_id)
);

alter table public.assistant_pending_clarifications enable row level security;
revoke all on public.assistant_pending_clarifications from public, anon, authenticated;

create function public.get_assistant_pending_clarification(p_shop_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := (select auth.uid()); v_result jsonb;
begin
  if v_owner is null or not exists (
    select 1 from public.shops where id = p_shop_id and owner_id = v_owner
  ) then raise exception 'Not authorized for this shop' using errcode = '42501'; end if;
  delete from public.assistant_pending_clarifications
  where owner_id = v_owner and shop_id = p_shop_id and expires_at <= now();
  select jsonb_build_object('pending', pending, 'requestKey', request_key)
    into v_result from public.assistant_pending_clarifications
    where owner_id = v_owner and shop_id = p_shop_id and expires_at > now();
  return v_result;
end;
$$;

create function public.save_assistant_pending_clarification(p_shop_id uuid, p_pending jsonb, p_request_key uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := (select auth.uid());
begin
  if v_owner is null or not exists (
    select 1 from public.shops where id = p_shop_id and owner_id = v_owner
  ) then raise exception 'Not authorized for this shop' using errcode = '42501'; end if;
  if p_pending is null or jsonb_typeof(p_pending) <> 'object' or length(p_pending::text) > 8192 or p_request_key is null then
    raise exception 'Invalid Assistant clarification' using errcode = '22023';
  end if;
  insert into public.assistant_pending_clarifications(owner_id, shop_id, pending, request_key, updated_at, expires_at)
  values (v_owner, p_shop_id, p_pending, p_request_key, now(), now() + interval '30 minutes')
  on conflict (owner_id, shop_id) do update set pending = excluded.pending, request_key = excluded.request_key,
    updated_at = excluded.updated_at, expires_at = excluded.expires_at;
end;
$$;

create function public.clear_assistant_pending_clarification(p_shop_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := (select auth.uid());
begin
  if v_owner is null or not exists (
    select 1 from public.shops where id = p_shop_id and owner_id = v_owner
  ) then raise exception 'Not authorized for this shop' using errcode = '42501'; end if;
  delete from public.assistant_pending_clarifications where owner_id = v_owner and shop_id = p_shop_id;
end;
$$;

revoke execute on function public.get_assistant_pending_clarification(uuid) from public, anon;
revoke execute on function public.save_assistant_pending_clarification(uuid, jsonb, uuid) from public, anon;
revoke execute on function public.clear_assistant_pending_clarification(uuid) from public, anon;
grant execute on function public.get_assistant_pending_clarification(uuid) to authenticated;
grant execute on function public.save_assistant_pending_clarification(uuid, jsonb, uuid) to authenticated;
grant execute on function public.clear_assistant_pending_clarification(uuid) to authenticated;
