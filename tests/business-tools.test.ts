import { describe, expect, it } from "vitest";
import { businessActionSchema } from "../src/lib/business/schemas";
import { indiaDayBounds, khataBalance, salePreviewTotal, todayInIndia, totalKhataOutstanding } from "../src/lib/business/calculations";
import { BusinessToolExecutor, describeToolResult, type BusinessRepository } from "../src/server/tools/business-executor";
import { executeValidatedToolCall } from "../src/server/tools/contracts";
import { matchShoppingList } from "../src/lib/assistant/match-shopping-list";
import { toolCallSchema } from "../src/lib/ai/types/tool-call";
import { reorderSuggestions } from "../src/lib/business/reorder";

function fakeRepository() {
  const maggiId = "11111111-1111-4111-8111-111111111112";
  let stock = 20;
  let entries: { type: "gave" | "received"; amount: number }[] = [
    { type: "gave", amount: 460 }, { type: "received", amount: 200 },
  ];
  const customers = [{ id: "rahul-id", name: "Rahul Sharma" }];
  const repository: BusinessRepository = {
    async products() { return [{ id: maggiId, name: "Maggi", unit: "packet", currentStock: stock, sellingPrice: 15 }]; },
    async adjustStock(_id, delta) {
      if (stock + delta < 0) throw new Error("Insufficient stock.");
      stock += delta;
      return stock;
    },
    async customers() { return customers; },
    async createCustomer(name) { const id = "11111111-1111-4111-8111-111111111113"; customers.push({ id, name }); return id; },
    async openAccount(name, amount) { const id = "11111111-1111-4111-8111-111111111114"; customers.push({ id, name }); entries = [...entries, { type: "gave", amount }]; return id; },
    async ledger() { return entries; },
    async addEntry(_id, type, amount) { entries = [...entries, { type, amount }]; },
    async dailySales() { return { total: 310, count: 2 }; },
    async recordSale(items) {
      const amount = items.reduce((sum, item) => sum + item.quantity * 15, 0);
      if (items.some((item) => item.quantity > stock)) throw new Error("Insufficient stock. No sale was recorded.");
      stock -= items.reduce((sum, item) => sum + item.quantity, 0);
      return { saleId: "11111111-1111-4111-8111-111111111115", total: amount };
    },
    async suppliers() { return [{ id: "11111111-1111-4111-8111-111111111116", name: "North Market Distributors" }]; },
    async createSupplier() { return "11111111-1111-4111-8111-111111111117"; },
    async reorderSuggestions() { return [{ product: "Maggi", stock, threshold: 10, quantity: Math.max(1, 20 - stock) }]; },
    async openOrders() { return []; },
    async createOrderDraft() { return "11111111-1111-4111-8111-111111111118"; },
  };
  return { repository, getStock: () => stock, getCustomers: () => customers, getEntries: () => entries };
}

describe("business boundary", () => {
  it("derives reorder quantities and rejects invalid purchase orders", () => {
    const suggestions = reorderSuggestions([{ id: "a", name: "Milk", current_stock: 3, low_stock_threshold: 5, cost_price: 20, selling_price: 25 },
      { id: "b", name: "Tea", current_stock: 20, low_stock_threshold: 5, cost_price: null, selling_price: 10 }]);
    expect(suggestions).toMatchObject([{ name: "Milk", quantity: 7 }]);
    expect(businessActionSchema.safeParse({ kind: "order.createDraft", supplierId: "bad", items: [] }).success).toBe(false);
    expect(toolCallSchema.safeParse({ intent: "orders.createDraft", arguments: { supplier: "North Market", items: [{ product: "Milk", quantity: -1 }] } }).success).toBe(false);
  });

  it("creates an internal order draft only after the trusted repository returns", async () => {
    const fake = fakeRepository();
    const result = await executeValidatedToolCall({ intent: "orders.createDraft", arguments: {
      supplier: "North Market Distributors", items: [{ product: "Maggi", quantity: 10 }],
    } }, new BusinessToolExecutor(fake.repository));
    expect(result).toMatchObject({ ok: true, data: { itemCount: 1 } });
    expect(describeToolResult(result).reply).toContain("No supplier was contacted");
    expect(fake.getStock()).toBe(20);
  });

  it("never confirms an order draft after a repository failure", async () => {
    const fake = fakeRepository();
    fake.repository.createOrderDraft = async () => { throw new Error("Purchase order draft could not be saved."); };
    const result = await executeValidatedToolCall({ intent: "orders.createDraft", arguments: {
      supplier: "North Market Distributors", items: [{ product: "Maggi", quantity: 10 }],
    } }, new BusinessToolExecutor(fake.repository));
    expect(result.ok).toBe(false);
    expect(describeToolResult(result).title).toBe("Action not completed");
    expect(fake.getStock()).toBe(20);
  });

  it("rejects unknown suppliers and products without saving an order", async () => {
    const executor = new BusinessToolExecutor(fakeRepository().repository);
    expect(await executor.execute({ intent: "orders.createDraft", arguments: { supplier: "Missing", items: [{ product: "Maggi", quantity: 1 }] } })).toMatchObject({ ok: false });
    expect(await executor.execute({ intent: "orders.createDraft", arguments: { supplier: "North Market Distributors", items: [{ product: "Missing", quantity: 1 }] } })).toMatchObject({ ok: false });
  });
  it("rejects invalid product and sale input before a database call", () => {
    expect(businessActionSchema.safeParse({ kind: "product.adjust", id: "bad-id", delta: 0 }).success).toBe(false);
    expect(businessActionSchema.safeParse({ kind: "sale.record", items: [{ productId: "bad-id", quantity: -1 }], paymentMethod: "cash" }).success).toBe(false);
    const product = { kind: "product.create", name: "Test", unit: "piece", sellingPrice: 0.29, threshold: 0, openingStock: 0 };
    expect(businessActionSchema.safeParse(product).success).toBe(true);
    expect(businessActionSchema.safeParse({ ...product, sellingPrice: 0.291 }).success).toBe(false);
  });

  it("calculates khata outstanding with the documented sign convention", () => {
    expect(khataBalance([{ type: "gave", amount: 460 }, { type: "received", amount: 200 }])).toBe(260);
    expect(totalKhataOutstanding([
      { customer_id: "a", type: "gave", amount: 460 },
      { customer_id: "a", type: "received", amount: 200 },
      { customer_id: "b", type: "received", amount: 50 },
    ])).toBe(260);
  });

  it("calculates a sale preview in paise and rejects unknown products", () => {
    const products = [{ id: "a", selling_price: 15.5 }, { id: "b", selling_price: 10 }];
    expect(salePreviewTotal([{ productId: "a", quantity: 2 }, { productId: "b", quantity: 3 }], products)).toBe(61);
    expect(() => salePreviewTotal([{ productId: "missing", quantity: 1 }], products)).toThrow();
  });

  it("uses India business-day bounds for sales queries", () => {
    expect(indiaDayBounds("2026-10-07")).toEqual({ start: "2026-10-06T18:30:00.000Z", end: "2026-10-07T18:30:00.000Z" });
    expect(todayInIndia(new Date("2026-10-06T19:00:00Z"))).toBe("2026-10-07");
  });

  it("confirms a stock adjustment only after the repository succeeds", async () => {
    const fake = fakeRepository();
    const executor = new BusinessToolExecutor(fake.repository);
    const result = await executeValidatedToolCall({ intent: "inventory.adjust", arguments: { product: "Maggi", delta: 20 } }, executor);
    expect(result).toMatchObject({ ok: true, data: { newStock: 40 } });
    expect(fake.getStock()).toBe(40);
    expect(describeToolResult(result).reply).toContain("Done.");
  });

  it("does not claim success when stock is insufficient", async () => {
    const fake = fakeRepository();
    const result = await new BusinessToolExecutor(fake.repository).execute({ intent: "inventory.adjust", arguments: { product: "Maggi", delta: -21 } });
    expect(result.ok).toBe(false);
    expect(fake.getStock()).toBe(20);
    expect(describeToolResult(result).title).toBe("Action not completed");
  });

  it("reads Rahul Sharma from the Sharma ji alias and derives his balance", async () => {
    const executor = new BusinessToolExecutor(fakeRepository().repository);
    const result = await executor.execute({ intent: "khata.getBalance", arguments: { customer: "Sharma ji" } });
    expect(result).toMatchObject({ ok: true, data: { customer: "Rahul Sharma", balance: 260 } });
  });

  it("saves a khata entry before calculating the new balance", async () => {
    const executor = new BusinessToolExecutor(fakeRepository().repository);
    const result = await executor.execute({ intent: "khata.addEntry", arguments: { customer: "Sharma ji", type: "gave", amountRupees: 100 } });
    expect(result).toMatchObject({ ok: true, data: { balance: 360 } });
  });

  it("creates a customer and opening udhaar through the trusted repository", async () => {
    const fake = fakeRepository();
    const result = await executeValidatedToolCall({ intent: "khata.openAccount", arguments: { customer: "Nandini", amountRupees: 100 } }, new BusinessToolExecutor(fake.repository));
    expect(result).toMatchObject({ ok: true, data: { customer: "Nandini", balance: 100 } });
    expect(fake.getCustomers()).toContainEqual({ id: "11111111-1111-4111-8111-111111111114", name: "Nandini" });
    expect(fake.getEntries()).toContainEqual({ type: "gave", amount: 100 });
  });

  it("records a repayment as received and reduces outstanding", async () => {
    const result = await new BusinessToolExecutor(fakeRepository().repository).execute({ intent: "khata.addEntry", arguments: { customer: "Sharma ji", type: "received", amountRupees: 50 } });
    expect(result).toMatchObject({ ok: true, data: { balance: 210, type: "received" } });
    expect(describeToolResult(result).title).toBe("Payment recorded");
  });

  it("validates a shopping-list draft without changing stock", async () => {
    const fake = fakeRepository();
    const result = await new BusinessToolExecutor(fake.repository).execute({ intent: "inventory.checkList", arguments: { items: [
      { product: "Maggi", quantity: 2 }, { product: "Tata Salt", quantity: 1 },
    ] } });
    expect(result).toMatchObject({ ok: true, data: { draft: { canConfirm: false, estimatedTotal: 30,
      items: [{ status: "available", unitPrice: 15 }, { status: "missing" }] } } });
    expect(fake.getStock()).toBe(20);
    expect(() => matchShoppingList([{ product: "Maggi", quantity: 1 }, { product: "maggi", quantity: 2 }], [{ id: "11111111-1111-4111-8111-111111111112", name: "Maggi", unit: "packet", currentStock: 20, sellingPrice: 15 }])).toThrow("repeats");
  });

  it("records a confirmed basket only after trusted sale success", async () => {
    const fake = fakeRepository();
    const executor = new BusinessToolExecutor(fake.repository);
    const productId = "11111111-1111-4111-8111-111111111112";
    const rejected = await executor.execute({ intent: "sales.recordConfirmedBasket", arguments: { items: [{ productId, quantity: 21 }], paymentMethod: "cash" } });
    expect(rejected.ok).toBe(false);
    expect(fake.getStock()).toBe(20);
    expect(describeToolResult(rejected).title).toBe("Action not completed");
    const saved = await executor.execute({ intent: "sales.recordConfirmedBasket", arguments: { items: [{ productId, quantity: 2 }], paymentMethod: "upi" } });
    expect(saved).toMatchObject({ ok: true, data: { total: 30 } });
    expect(fake.getStock()).toBe(18);
    expect(toolCallSchema.safeParse({ intent: "sales.recordConfirmedBasket", arguments: { items: [{ productId, quantity: 0 }], paymentMethod: "cash" } }).success).toBe(false);
  });

  it("returns an authoritative daily sales summary", async () => {
    const result = await new BusinessToolExecutor(fakeRepository().repository).execute({ intent: "sales.getDailySummary", arguments: { date: "2026-10-07" } });
    expect(result).toMatchObject({ ok: true, data: { total: 310, count: 2 } });
  });
});
