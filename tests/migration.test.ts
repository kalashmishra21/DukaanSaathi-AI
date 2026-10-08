import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync("supabase/migrations/20261007000100_initial_business.sql", "utf8");
const hardeningMigration = readFileSync("supabase/migrations/20261008071313_hardening_indexes.sql", "utf8");
const userId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";

describe("Supabase migration in local PostgreSQL", () => {
  it("seeds idempotently, enforces ownership, and rolls back failed sales", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        create role anon;
        create role authenticated;
        create schema auth;
        create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        $$;
        alter default privileges in schema public grant all on tables to authenticated;
      `);
      await db.exec(migration);
      await db.exec(hardeningMigration);
      const hardening = await db.query<{ function_executable: boolean; index_count: number }>(`
        select
          has_function_privilege('authenticated', 'public.create_profile_for_user()', 'EXECUTE') as function_executable,
          (select count(*)::integer from pg_indexes where schemaname = 'public' and indexname in (
            'ai_actions_shop_id_idx', 'inventory_movements_product_shop_idx',
            'khata_entries_customer_shop_idx', 'khata_entries_shop_created_idx',
            'sale_items_product_shop_idx', 'sale_items_sale_shop_idx', 'sale_items_shop_id_idx'
          )) as index_count
      `);
      expect(hardening.rows[0]).toEqual({ function_executable: false, index_count: 7 });
      await db.exec(`
        grant usage on schema public, auth to authenticated;
        insert into auth.users(id, raw_user_meta_data) values
          ('${userId}', '{}'::jsonb), ('${otherId}', '{}'::jsonb);
        set role authenticated;
        set request.jwt.claim.sub = '${userId}';
      `);
      const first = await db.query<{ bootstrap_demo_shop: string }>("select public.bootstrap_demo_shop()");
      const shopId = first.rows[0].bootstrap_demo_shop;
      const again = await db.query<{ bootstrap_demo_shop: string }>("select public.bootstrap_demo_shop()");
      expect(again.rows[0].bootstrap_demo_shop).toBe(shopId);
      const seeded = await db.query<{ products: number; customers: number; sales: number }>(`
        select
          (select count(*)::integer from public.products where shop_id = '${shopId}') products,
          (select count(*)::integer from public.customers where shop_id = '${shopId}') customers,
          (select count(*)::integer from public.sales where shop_id = '${shopId}') sales
      `);
      expect(seeded.rows[0]).toEqual({ products: 5, customers: 3, sales: 1 });
      const newProduct = await db.query<{ create_product: string }>(`select public.create_product('${shopId}', 'Test Tea', 'TEA-001', 'packet', 25, 18, 3, 7)`);
      const opening = await db.query<{ current_stock: number; movements: number }>(`
        select p.current_stock,
          (select count(*)::integer from public.inventory_movements where product_id = p.id) movements
        from public.products p where p.id = '${newProduct.rows[0].create_product}'
      `);
      expect(opening.rows[0]).toEqual({ current_stock: 7, movements: 1 });
      await expect(db.query(`update public.products set archived_at = now() where id = '${newProduct.rows[0].create_product}'`)).rejects.toThrow();
      await db.query(`select public.adjust_stock('${shopId}', '${newProduct.rows[0].create_product}', -7, 'Clear stock')`);
      await db.query(`update public.products set archived_at = now() where id = '${newProduct.rows[0].create_product}'`);
      await expect(db.query(`select public.adjust_stock('${shopId}', '${newProduct.rows[0].create_product}', 1, 'Archived')`)).rejects.toThrow();

      const product = await db.query<{ id: string; current_stock: number }>(`select id, current_stock from public.products where shop_id = '${shopId}' and name = 'Maggi'`);
      const maggi = product.rows[0];
      expect(maggi.current_stock).toBe(46);
      await expect(db.query(`update public.products set current_stock = 999 where id = '${maggi.id}'`)).rejects.toThrow();
      await expect(db.query(`insert into public.sales(shop_id,total_amount) values ('${shopId}', 999)`)).rejects.toThrow();
      const adjusted = await db.query<{ adjust_stock: number }>(`select public.adjust_stock('${shopId}', '${maggi.id}', 20, 'Test')`);
      expect(adjusted.rows[0].adjust_stock).toBe(66);
      await expect(db.query(`select public.adjust_stock('${shopId}', '${maggi.id}', -999, 'Invalid')`)).rejects.toThrow();

      const beforeSale = await db.query<{ count: number }>(`select count(*)::integer as count from public.sales where shop_id = '${shopId}'`);
      await expect(db.query(`select public.record_sale('${shopId}', '[{"productId":"${maggi.id}","quantity":1000}]'::jsonb, 'cash')`)).rejects.toThrow();
      const afterSale = await db.query<{ count: number }>(`select count(*)::integer as count from public.sales where shop_id = '${shopId}'`);
      expect(afterSale.rows[0].count).toBe(beforeSale.rows[0].count);
      const successful = await db.query<{ record_sale: string }>(`select public.record_sale('${shopId}', '[{"productId":"${maggi.id}","quantity":2}]'::jsonb, 'upi')`);
      const saved = await db.query<{ total_amount: string }>(`select total_amount from public.sales where id = '${successful.rows[0].record_sale}'`);
      expect(Number(saved.rows[0].total_amount)).toBe(30);

      await db.exec(`set request.jwt.claim.sub = '${otherId}';`);
      const hidden = await db.query<{ count: number }>(`select count(*)::integer as count from public.products where shop_id = '${shopId}'`);
      expect(hidden.rows[0].count).toBe(0);
      await expect(db.query(`select public.adjust_stock('${shopId}', '${maggi.id}', 1, 'Cross shop')`)).rejects.toThrow();
    } finally {
      await db.close();
    }
  }, 30000);
});
