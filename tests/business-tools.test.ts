import { describe, expect, it } from "vitest";
import { businessActionSchema } from "../src/lib/business/schemas";
import { indiaDayBounds, khataBalance, salePreviewTotal, todayInIndia, totalKhataOutstanding } from "../src/lib/business/calculations";
import { BusinessToolExecutor, describeToolResult, type BusinessRepository } from "../src/server/tools/business-executor";
import { executeValidatedToolCall } from "../src/server/tools/contracts";

function fakeRepository() {
  let stock = 20;
  let entries: { type: "gave" | "received"; amount: number }[] = [
    { type: "gave", amount: 460 }, { type: "received", amount: 200 },
  ];
  const repository: BusinessRepository = {
    async products() { return [{ id: "maggi-id", name: "Maggi", currentStock: stock }]; },
    async adjustStock(_id, delta) {
      if (stock + delta < 0) throw new Error("Insufficient stock.");
      stock += delta;
      return stock;
    },
    async customers() { return [{ id: "rahul-id", name: "Rahul Sharma" }]; },
    async ledger() { return entries; },
    async addEntry(_id, amount) { entries = [...entries, { type: "gave", amount }]; },
    async dailySales() { return { total: 310, count: 2 }; },
  };
  return { repository, getStock: () => stock };
}

describe("business boundary", () => {
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
    const result = await executor.execute({ intent: "khata.addEntry", arguments: { customer: "Sharma ji", amountRupees: 100 } });
    expect(result).toMatchObject({ ok: true, data: { balance: 360 } });
  });

  it("returns an authoritative daily sales summary", async () => {
    const result = await new BusinessToolExecutor(fakeRepository().repository).execute({ intent: "sales.getDailySummary", arguments: { date: "2026-10-07" } });
    expect(result).toMatchObject({ ok: true, data: { total: 310, count: 2 } });
  });
});
