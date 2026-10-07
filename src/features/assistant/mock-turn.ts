import type { ReasoningResult } from "@/lib/ai/types/tool-call";

export type MockTurn = {
  title: string;
  intent: string;
  detail: string;
  reply: string;
};

export function describeMockTurn(result: ReasoningResult): MockTurn {
  if (result.kind === "unsupported") {
    return {
      title: "Not available in this mock",
      intent: "unsupported",
      detail: "The current mock has two deterministic example requests.",
      reply: "I can preview the Maggi stock adjustment and Sharma ji balance request. This request is planned for a later phase.",
    };
  }

  if (result.tool.intent === "inventory.adjust") {
    const { product, delta } = result.tool.arguments;
    return {
      title: "Stock adjustment proposed",
      intent: result.tool.intent,
      detail: `${product} · ${delta > 0 ? "+" : ""}${delta} packets`,
      reply: `I understood a ${delta > 0 ? "stock increase" : "stock decrease"} for ${product}. This is only a mock preview; no inventory was changed.`,
    };
  }

  if (result.tool.intent === "khata.getBalance") {
    return {
      title: "Balance lookup prepared",
      intent: result.tool.intent,
      detail: `Customer · ${result.tool.arguments.customer}`,
      reply: `I recognized the balance request for ${result.tool.arguments.customer}. A connected khata is needed before I can show a real amount.`,
    };
  }

  return {
    title: "Action preview",
    intent: result.tool.intent,
    detail: "A trusted business tool is required.",
    reply: "I prepared a structured request. No store data is connected, so I cannot confirm a result yet.",
  };
}
