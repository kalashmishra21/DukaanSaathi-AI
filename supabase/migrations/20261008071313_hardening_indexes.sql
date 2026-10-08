revoke execute on function public.create_profile_for_user() from public, anon, authenticated;

create index if not exists ai_actions_shop_id_idx
  on public.ai_actions(shop_id);

create index if not exists inventory_movements_product_shop_idx
  on public.inventory_movements(product_id, shop_id);

create index if not exists khata_entries_customer_shop_idx
  on public.khata_entries(customer_id, shop_id);

create index if not exists khata_entries_shop_created_idx
  on public.khata_entries(shop_id, created_at desc);

create index if not exists sale_items_product_shop_idx
  on public.sale_items(product_id, shop_id);

create index if not exists sale_items_sale_shop_idx
  on public.sale_items(sale_id, shop_id);

create index if not exists sale_items_shop_id_idx
  on public.sale_items(shop_id);
