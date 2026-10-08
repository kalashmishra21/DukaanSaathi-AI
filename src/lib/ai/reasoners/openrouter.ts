import { z } from "zod";
import { todayInIndia } from "../../business/calculations";
import { MockAIProvider } from "../providers/mock";
import { reasoningResultSchema, type ReasoningResult, type ToolCall } from "../types/tool-call";
import type { ReasoningInput } from "../types/provider";

const endpoint = "https://openrouter.ai/api/v1/chat/completions";
const field = { type: "string" } as const;
const integer = { type: "integer" } as const;
const parameters = (properties: Record<string, unknown>, required: string[]) =>
  ({ type: "object", properties, required, additionalProperties: false });
const listItems = { type: "array", minItems: 1, maxItems: 30, items: parameters({ product: field, quantity: integer }, ["product", "quantity"]) };

const tools = [
  ["inventory_adjust", "Propose a stock change. Positive delta adds stock; negative delta removes it.", parameters({ product: field, delta: integer }, ["product", "delta"])],
  ["inventory_getStock", "Read the current stock of a product.", parameters({ product: field }, ["product"])],
  ["khata_getBalance", "Read how much a customer owes the shop.", parameters({ customer: field }, ["customer"])],
  ["khata_addEntry", "Record a customer's ledger event. Use type received when the customer pays or returns money; gave when the shop gives new credit.", parameters({ customer: field, type: { type: "string", enum: ["gave", "received"] }, amountRupees: integer }, ["customer", "type", "amountRupees"])],
  ["customer_create", "Add a customer with no opening credit, only when the request does not mention udhaar or opening balance.", parameters({ customer: field }, ["customer"])],
  ["khata_openAccount", "Create a NEW customer and opening udhaar together. Use only when the opening amount is explicit.", parameters({ customer: field, amountRupees: integer }, ["customer", "amountRupees"])],
  ["clarify_openAccount", "Ask for the opening amount when a new udhaar customer or khata is requested without any amount. No customer is created yet.", parameters({ customer: field }, ["customer"])],
  ["inventory_checkList", "Read inventory and prices for a shopping list. This is a draft, never a sale.", parameters({ items: listItems }, ["items"])],
  ["sales_getDailySummary", "Read total sales for a YYYY-MM-DD date.", parameters({ date: field }, ["date"])],
] as const;

const intentByFunction: Record<string, ToolCall["intent"]> = {
  inventory_adjust: "inventory.adjust",
  inventory_getStock: "inventory.getStock",
  khata_getBalance: "khata.getBalance",
  khata_addEntry: "khata.addEntry",
  customer_create: "customer.create",
  khata_openAccount: "khata.openAccount",
  inventory_checkList: "inventory.checkList",
  sales_getDailySummary: "sales.getDailySummary",
};

const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({
    tool_calls: z.array(z.object({ function: z.object({ name: z.string(), arguments: z.string() }) })).optional(),
  }) })).min(1),
});

export class OpenRouterReasoner {
  constructor(
    private readonly key: string,
    private readonly model: string,
    private readonly request: typeof fetch = fetch,
    private readonly today: () => string = todayInIndia,
  ) {}

  async reason(input: ReasoningInput): Promise<ReasoningResult> {
    const text = z.string().trim().min(1).max(500).parse(input.text);
    // Exact supported merchant phrases stay usable when the free model is busy.
    // The result still crosses the same Zod and trusted-tool boundary.
    const recognized = await new MockAIProvider(this.today).reason({ ...input, text });
    if (recognized.kind !== "unsupported") return reasoningResultSchema.parse(recognized);
    const response = await this.request(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: `Classify one Indian retailer request into exactly one function call. Only propose a function; never claim it ran. Interpret Hindi, Hinglish and English. Today in India is ${this.today()}. Preserve the merchant's product and customer names. Convert Hindi numerals to integers. For today's sales use today's date. A new udhaar khata with a stated amount needs khata_openAccount; if amount is missing choose clarify_openAccount, never customer_create. A repayment needs khata_addEntry with type received. A shopping list needs inventory_checkList; do not record a sale. If uncertain, do not call any function.` },
          ...(input.recent ?? []).slice(-6).map((turn) => ({ role: turn.role, content: turn.text })),
          { role: "user", content: text },
        ],
        tools: tools.map(([name, description, schema]) => ({ type: "function", function: { name, description, parameters: schema } })),
        tool_choice: "auto",
        parallel_tool_calls: false,
        temperature: 0,
        max_tokens: 400,
        stream: false,
      }),
      signal: AbortSignal.timeout(35_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`OpenRouter reasoning failed (${response.status}).`);
    const raw: unknown = await response.json();
    if (z.object({ error: z.unknown() }).safeParse(raw).success) {
      throw new Error("OpenRouter reasoning provider is temporarily unavailable.");
    }
    const parsed = completionSchema.safeParse(raw);
    if (!parsed.success) throw new Error("OpenRouter returned an invalid completion.");
    const calls = parsed.data.choices[0].message.tool_calls;
    if (!calls?.length) return { kind: "unsupported", message: "No safe intent was identified." };
    if (calls.length !== 1) throw new Error("OpenRouter proposed multiple actions.");
    if (calls[0].function.name === "clarify_openAccount") {
      let args: unknown;
      try { args = JSON.parse(calls[0].function.arguments); } catch { throw new Error("OpenRouter returned invalid clarification arguments."); }
      const customer = z.object({ customer: z.string().trim().min(1).max(120) }).strict().parse(args).customer;
      return reasoningResultSchema.parse({ kind: "clarify", question: `${customer} ke khate mein shuru mein kitna udhaar likhun?`, pending: { kind: "open-account-amount", customer } });
    }
    const intent = intentByFunction[calls[0].function.name];
    if (!intent) throw new Error("OpenRouter proposed an unknown action.");
    let args: unknown;
    try { args = JSON.parse(calls[0].function.arguments); } catch { throw new Error("OpenRouter returned invalid tool arguments."); }
    return reasoningResultSchema.parse({ kind: "tool_call", tool: { intent, arguments: args } });
  }
}
