-- Cover owner-scoped purchase-order item reads and the shop foreign key.
create index if not exists purchase_order_items_shop_id_idx
  on public.purchase_order_items (shop_id);
