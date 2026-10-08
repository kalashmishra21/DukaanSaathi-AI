import { z } from "zod";
import { todayInIndia } from "../../business/calculations";
import { reasoningResultSchema, type ReasoningResult, type ToolCall } from "../types/tool-call";
import type { ReasoningInput } from "../types/provider";

const endpoint = "https://openrouter.ai/api/v1/chat/completions";
const field = { type: "string" } as const;
const integer = { type: "integer" } as const;
const parameters = (properties: Record<string, typeof field | typeof integer>, required: string[]) =>
  ({ type: "object", properties, required, additionalProperties: false });

const tools = [
  ["inventory_adjust", "Propose a stock change. Positive delta adds stock; negative delta removes it.", parameters({ product: field, delta: integer }, ["product", "delta"])],
  ["inventory_getStock", "Read the current stock of a product.", parameters({ product: field }, ["product"])],
  ["khata_getBalance", "Read how much a customer owes the shop.", parameters({ customer: field }, ["customer"])],
  ["khata_addEntry", "Propose new credit given to a customer, as a positive amount in rupees.", parameters({ customer: field, amountRupees: integer }, ["customer", "amountRupees"])],
  ["sales_getDailySummary", "Read total sales for a YYYY-MM-DD date.", parameters({ date: field }, ["date"])],
] as const;

const intentByFunction: Record<string, ToolCall["intent"]> = {
  inventory_adjust: "inventory.adjust",
  inventory_getStock: "inventory.getStock",
  khata_getBalance: "khata.getBalance",
  khata_addEntry: "khata.addEntry",
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
    const response = await this.request(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: `Classify one Indian retailer request into exactly one function call. Only propose a function; never claim it ran. Interpret Hindi, Hinglish and English. Today in India is ${this.today()}. Preserve the merchant's product and customer names. Convert Hindi numerals to integers. For today's sales use today's date. If uncertain, do not call any function.` },
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
    const parsed = completionSchema.safeParse(raw);
    if (!parsed.success) throw new Error("OpenRouter returned an invalid completion.");
    const calls = parsed.data.choices[0].message.tool_calls;
    if (!calls?.length) return { kind: "unsupported", message: "No safe intent was identified." };
    if (calls.length !== 1) throw new Error("OpenRouter proposed multiple actions.");
    const intent = intentByFunction[calls[0].function.name];
    if (!intent) throw new Error("OpenRouter proposed an unknown action.");
    let args: unknown;
    try { args = JSON.parse(calls[0].function.arguments); } catch { throw new Error("OpenRouter returned invalid tool arguments."); }
    return reasoningResultSchema.parse({ kind: "tool_call", tool: { intent, arguments: args } });
  }
}
