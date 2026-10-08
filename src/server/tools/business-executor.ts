import { khataBalance, rupees } from "../../lib/business/calculations";
import type { ToolCall } from "../../lib/ai/types/tool-call";
import type { TrustedToolExecutor, ToolExecutionResult } from "./contracts";

export type ProductRecord = { id: string; name: string; currentStock: number };
export type CustomerRecord = { id: string; name: string };
export type LedgerRecord = { type: "gave" | "received"; amount: number };

export interface BusinessRepository {
  products(): Promise<ProductRecord[]>;
  adjustStock(productId: string, delta: number): Promise<number>;
  customers(): Promise<CustomerRecord[]>;
  ledger(customerId: string): Promise<LedgerRecord[]>;
  addEntry(customerId: string, amount: number, note?: string): Promise<void>;
  dailySales(date: string): Promise<{ total: number; count: number }>;
}

function matchByName<T extends { name: string }>(records: T[], rawName: string): T | null {
  const requested = rawName.toLocaleLowerCase("en-IN").replace(/\bji\b/g, "").trim();
  const exact = records.find((record) => record.name.toLocaleLowerCase("en-IN") === requested);
  if (exact) return exact;
  const matches = records.filter((record) =>
    record.name.toLocaleLowerCase("en-IN").split(/\s+/).includes(requested));
  if (matches.length > 1) throw new Error("More than one record matches that name. Use the full name.");
  return matches[0] ?? null;
}

export class BusinessToolExecutor implements TrustedToolExecutor {
  constructor(private readonly repository: BusinessRepository) {}

  async execute(call: ToolCall): Promise<ToolExecutionResult> {
    try {
      switch (call.intent) {
        case "inventory.adjust": {
          const product = matchByName(await this.repository.products(), call.arguments.product);
          if (!product) return { ok: false, error: "Product not found." };
          const newStock = await this.repository.adjustStock(product.id, call.arguments.delta);
          return { ok: true, data: { intent: call.intent, product: product.name, delta: call.arguments.delta, newStock } };
        }
        case "inventory.getStock": {
          const product = matchByName(await this.repository.products(), call.arguments.product);
          if (!product) return { ok: false, error: "Product not found." };
          return { ok: true, data: { intent: call.intent, product: product.name, stock: product.currentStock } };
        }
        case "khata.getBalance": {
          const customer = matchByName(await this.repository.customers(), call.arguments.customer);
          if (!customer) return { ok: false, error: "Customer not found." };
          const balance = khataBalance(await this.repository.ledger(customer.id));
          return { ok: true, data: { intent: call.intent, customer: customer.name, balance } };
        }
        case "khata.addEntry": {
          const customer = matchByName(await this.repository.customers(), call.arguments.customer);
          if (!customer) return { ok: false, error: "Customer not found." };
          await this.repository.addEntry(customer.id, call.arguments.amountRupees, call.arguments.note);
          const balance = khataBalance(await this.repository.ledger(customer.id));
          return { ok: true, data: { intent: call.intent, customer: customer.name, amount: call.arguments.amountRupees, balance } };
        }
        case "sales.getDailySummary": {
          const summary = await this.repository.dailySales(call.arguments.date);
          return { ok: true, data: { intent: call.intent, date: call.arguments.date, ...summary } };
        }
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "The business action failed." };
    }
  }
}

export function describeToolResult(result: ToolExecutionResult): { title: string; detail: string; reply: string } {
  if (!result.ok) {
    return { title: "Action not completed", detail: result.error, reply: `I could not complete that request: ${result.error}` };
  }
  const data = result.data as Record<string, unknown>;
  switch (data.intent) {
    case "inventory.adjust":
      return { title: "Stock updated", detail: `${data.product} · ${data.newStock} in stock`, reply: `Done. ${data.product} stock is now ${data.newStock} after a ${Number(data.delta) > 0 ? "+" : ""}${data.delta} adjustment.` };
    case "inventory.getStock":
      return { title: "Stock checked", detail: `${data.product} · ${data.stock} in stock`, reply: `${data.product} has ${data.stock} units in stock.` };
    case "khata.getBalance":
      return { title: "Balance checked", detail: `${data.customer} · ${rupees(Number(data.balance))} outstanding`, reply: `${data.customer}'s outstanding balance is ${rupees(Number(data.balance))}.` };
    case "khata.addEntry":
      return { title: "Khata entry saved", detail: `${data.customer} · ${rupees(Number(data.balance))} outstanding`, reply: `The ${rupees(Number(data.amount))} entry was saved. ${data.customer}'s outstanding balance is now ${rupees(Number(data.balance))}.` };
    case "sales.getDailySummary":
      return { title: "Sales summary", detail: `${data.date} · ${rupees(Number(data.total))}`, reply: `Sales on ${data.date} total ${rupees(Number(data.total))} across ${data.count} sale(s).` };
    default:
      throw new Error("Unknown authoritative tool result.");
  }
}
