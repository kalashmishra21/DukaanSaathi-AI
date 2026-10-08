import "server-only";

import { z } from "zod";
import { indiaDayBounds } from "@/lib/business/calculations";
import type { ShopContext } from "./context";
import type { BusinessRepository, CustomerRecord, LedgerRecord, ProductRecord } from "../tools/business-executor";

type ReadyContext = Extract<ShopContext, { kind: "ready" }>;

export class SupabaseBusinessRepository implements BusinessRepository {
  constructor(private readonly context: ReadyContext) {}

  async products(): Promise<ProductRecord[]> {
    const { data, error } = await this.context.client.from("products")
      .select("id,name,current_stock").eq("shop_id", this.context.shop.id).is("archived_at", null);
    if (error) throw new Error("Inventory is unavailable.");
    return z.array(z.object({ id: z.uuid(), name: z.string(), current_stock: z.number().int() }))
      .parse(data).map((row) => ({ id: row.id, name: row.name, currentStock: row.current_stock }));
  }

  async adjustStock(productId: string, delta: number): Promise<number> {
    const { data, error } = await this.context.client.rpc("adjust_stock", {
      p_shop_id: this.context.shop.id, p_product_id: productId, p_delta: delta, p_note: "Assistant request",
    });
    if (error) throw new Error(error.code === "P0001" ? "Product missing or insufficient stock." : "Stock adjustment failed.");
    return z.number().int().parse(data);
  }

  async customers(): Promise<CustomerRecord[]> {
    const { data, error } = await this.context.client.from("customers")
      .select("id,name").eq("shop_id", this.context.shop.id);
    if (error) throw new Error("Khata is unavailable.");
    return z.array(z.object({ id: z.uuid(), name: z.string() })).parse(data);
  }

  async ledger(customerId: string): Promise<LedgerRecord[]> {
    const { data, error } = await this.context.client.from("khata_entries")
      .select("type,amount").eq("shop_id", this.context.shop.id).eq("customer_id", customerId);
    if (error) throw new Error("Khata balance is unavailable.");
    return z.array(z.object({ type: z.enum(["gave", "received"]), amount: z.coerce.number() })).parse(data);
  }

  async addEntry(customerId: string, amount: number, note?: string): Promise<void> {
    const { error } = await this.context.client.from("khata_entries").insert({
      shop_id: this.context.shop.id, customer_id: customerId, type: "gave", amount, note: note || null,
    });
    if (error) throw new Error("Khata entry could not be saved.");
  }

  async dailySales(date: string): Promise<{ total: number; count: number }> {
    const { start, end } = indiaDayBounds(date);
    const { data, error } = await this.context.client.from("sales")
      .select("total_amount").eq("shop_id", this.context.shop.id).gte("created_at", start).lt("created_at", end);
    if (error) throw new Error("Sales summary is unavailable.");
    const sales = z.array(z.object({ total_amount: z.coerce.number() })).parse(data);
    return { total: sales.reduce((total, sale) => total + Math.round(sale.total_amount * 100), 0) / 100, count: sales.length };
  }
}
