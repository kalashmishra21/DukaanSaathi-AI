import { reasoningResultSchema } from "../types/tool-call";
import type { AIProvider, ReasoningInput, SpeechResult, TranscriptionInput, TranscriptionResult } from "../types/provider";
import type { ReasoningResult } from "../types/tool-call";
import { todayInIndia } from "../../business/calculations";
import { completePendingAmount } from "../../assistant/clarification";
import { parseTextShoppingList } from "../../assistant/parse-text-list";

export class MockAIProvider implements AIProvider {
  constructor(private readonly today: () => string = todayInIndia) {}
  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    if (!input.mockTranscript?.trim()) {
      throw new Error("Mock transcription requires an explicit mockTranscript fixture.");
    }

    return { text: input.mockTranscript.trim(), language: input.languageHint };
  }

  async reason(input: ReasoningInput): Promise<ReasoningResult> {
    const completed = completePendingAmount(input);
    if (completed) return completed;
    const text = input.text.trim()
      .replace(/^मैगी के ([0-9०-९]+) पैकेट (?:ऐड|एड|जोड़) कर दो[.!?।]?$/u, (_, amount: string) =>
        `Maggi ke ${amount.replace(/[०-९]/gu, (digit) => String("०१२३४५६७८९".indexOf(digit)))} packet add kar do`)
      .replace(/^शर्मा जी का कितना उधार है[.!?।]?$/u, "Sharma ji ka kitna udhaar hai?")
      .replace(/^आज की (?:कुल|टोटल) सेल बताओ[.!?।]?$/u, "Aaj ki total sale batao")
      .replace(/[०-९]/gu, (digit) => String("०१२३४५६७८९".indexOf(digit)));

    const englishAdd = /^add (\d+) (?:packets?|units?) of (.+?) to (?:inventory|stock)[.!?]?$/i.exec(text);
    if (englishAdd) return reasoningResultSchema.parse({ kind: "tool_call", tool: {
      intent: "inventory.adjust", arguments: { product: englishAdd[2], delta: Number(englishAdd[1]) },
    } });

    const englishStock = /^(?:what(?:'s| is) the stock of|show (?:me )?the stock of) (.+?)[.!?]?$/i.exec(text);
    const hindiStock = /^(.+?) का स्टॉक बताओ[.!?।]?$/u.exec(text);
    if (englishStock || hindiStock) return reasoningResultSchema.parse({ kind: "tool_call", tool: {
      intent: "inventory.getStock", arguments: { product: hindiStock?.[1] === "मैगी" ? "Maggi" : (englishStock ?? hindiStock)![1] },
    } });

    const englishBalance = /^how much does (.+?) owe(?: (?:us|the shop))?[.!?]?$/i.exec(text);
    if (englishBalance) return reasoningResultSchema.parse({ kind: "tool_call", tool: {
      intent: "khata.getBalance", arguments: { customer: englishBalance[1] },
    } });

    if (/^(?:what(?:'s| is| are) today's sales|tell me today's (?:total )?sales|today's sales summary)[.!?]?$/i.test(text)
      || /^आज की (?:बिक्री|सेल) बताओ[.!?।]?$/u.test(text)) {
      return reasoningResultSchema.parse({ kind: "tool_call", tool: {
        intent: "sales.getDailySummary", arguments: { date: this.today() },
      } });
    }

    const openAccount = /^(.+?) ke naam se (\d+) rupaye ka naya udhaar khata bana do[.!?]?$/i.exec(text);
    if (/^(?:low[- ]stock items? ki reorder list bana do|reorder suggestions? batao)[.!?]?$/i.test(text))
      return reasoningResultSchema.parse({ kind: "tool_call", tool: { intent: "inventory.getReorderSuggestions", arguments: {} } });
    if (/^(?:suppliers? (?:dikhao|batao)|supplier list)[.!?]?$/i.test(text))
      return reasoningResultSchema.parse({ kind: "tool_call", tool: { intent: "supplier.list", arguments: {} } });
    const newSupplier = /^(?:new supplier )(.+?) add karo[.!?]?$/i.exec(text);
    if (newSupplier) return reasoningResultSchema.parse({ kind: "tool_call", tool: { intent: "supplier.create", arguments: { name: newSupplier[1] } } });
    if (/^(?:open orders? dikhao|purchase orders? dikhao)[.!?]?$/i.test(text))
      return reasoningResultSchema.parse({ kind: "tool_call", tool: { intent: "orders.getOpen", arguments: {} } });
    const order = /^(.+?) se (.+?) ke (\d+) (?:packet|piece|unit) ka purchase order draft banao[.!?]?$/i.exec(text);
    if (order) return reasoningResultSchema.parse({ kind: "tool_call", tool: { intent: "orders.createDraft", arguments: { supplier: order[1], items: [{ product: order[2], quantity: Number(order[3]) }] } } });

    if (openAccount) return reasoningResultSchema.parse({ kind: "tool_call", tool: {
      intent: "khata.openAccount", arguments: { customer: openAccount[1], amountRupees: Number(openAccount[2]) },
    } });

    const clarifyAccount = /^(.+?) naam se customer add karo udhaar wala[.!?]?$/i.exec(text);
    if (clarifyAccount) return reasoningResultSchema.parse({ kind: "clarify",
      question: `${clarifyAccount[1]} ke khate mein shuru mein kitna udhaar likhun?`,
      pending: { kind: "open-account-amount", customer: clarifyAccount[1] },
    });

    const newCustomer = /^(.+?) naam se customer add karo[.!?]?$/i.exec(text);
    if (newCustomer) return reasoningResultSchema.parse({ kind: "tool_call", tool: {
      intent: "customer.create", arguments: { customer: newCustomer[1] },
    } });

    const payment = /^(.+?) ne (\d+) rupaye wapas diye[.!?]?$/i.exec(text);
    if (payment) return reasoningResultSchema.parse({ kind: "tool_call", tool: {
      intent: "khata.addEntry", arguments: { customer: payment[1], type: "received", amountRupees: Number(payment[2]) },
    } });
    const shoppingList = /^(?:shopping list|list check karo):\s*(.+)$/i.exec(text);
    if (shoppingList) {
      try {
        const items = parseTextShoppingList(shoppingList[1].replace(/\s*,\s*/g, "\n"));
        return reasoningResultSchema.parse({ kind: "tool_call", tool: { intent: "inventory.checkList", arguments: { items } } });
      } catch {
        return reasoningResultSchema.parse({ kind: "unsupported", message: "Write each list item as product name and quantity, for example Maggi 2, Parle-G 3." });
      }
    }
    const inventory = /^maggi ke (\d+) packet add kar do[.!?]?$/i.exec(text);

    if (inventory) {
      const delta = Number(inventory[1]);
      if (!Number.isInteger(delta) || delta < 1 || delta > 100000) return reasoningResultSchema.parse({ kind: "unsupported", message: "Quantity is outside the demo range." });
      return reasoningResultSchema.parse({
        kind: "tool_call",
        tool: { intent: "inventory.adjust", arguments: { product: "Maggi", delta } },
      });
    }

    const stock = /^(.+?) ka stock batao[.!?]?$/i.exec(text);
    if (stock) return reasoningResultSchema.parse({
      kind: "tool_call", tool: { intent: "inventory.getStock", arguments: { product: stock[1] } },
    });

    const balanceRequest = /^(.+?) ka kitna udhaar hai[.!?]?$/i.exec(text);
    if (balanceRequest) {
      return reasoningResultSchema.parse({
        kind: "tool_call",
        tool: { intent: "khata.getBalance", arguments: { customer: balanceRequest[1] } },
      });
    }

    const khataEntry = /^(.+?) ko (\d+) rupaye udhaar likh do[.!?]?$/i.exec(text);
    if (khataEntry) {
      const amount = Number(khataEntry[2]);
      if (!Number.isInteger(amount) || amount < 1 || amount > 10000000) return reasoningResultSchema.parse({ kind: "unsupported", message: "Amount is outside the demo range." });
      return reasoningResultSchema.parse({
        kind: "tool_call", tool: { intent: "khata.addEntry", arguments: { customer: khataEntry[1], type: "gave", amountRupees: amount } },
      });
    }

    if (/^aaj ki (?:total )?sale batao[.!?]?$/i.test(text)) return reasoningResultSchema.parse({
      kind: "tool_call", tool: { intent: "sales.getDailySummary", arguments: { date: this.today() } },
    });

    // Ask for required details before a model can guess a product or quantity.
    if (!/\d/.test(text) && /(?:stock|maal|inventory)/i.test(text) && /(?:adjust|badhao|ghatao|add|kam)/i.test(text)) {
      return reasoningResultSchema.parse({ kind: "clarify", intent: "inventory.adjust",
        question: "Which product and how many units should I add or remove? Nothing was changed." });
    }

    return reasoningResultSchema.parse({
      kind: "unsupported",
      message: "This request is not available in the current mock.",
    });
  }

  async synthesize(text: string): Promise<SpeechResult> {
    return { kind: "text_fallback", text };
  }
}
