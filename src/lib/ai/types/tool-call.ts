import { z } from "zod";
import { shoppingItemSchema } from "../../assistant/shopping-list";

const name = z.string().trim().min(1).max(120);
const quantity = z.number().int().positive();

export const toolCallSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("inventory.adjust"),
    arguments: z.object({ product: name, delta: z.number().int().min(-100000).max(100000).refine((value) => value !== 0) }).strict(),
  }).strict(),
  z.object({
    intent: z.literal("inventory.getStock"),
    arguments: z.object({ product: name }).strict(),
  }).strict(),
  z.object({
    intent: z.literal("khata.getBalance"),
    arguments: z.object({ customer: name }).strict(),
  }).strict(),
  z.object({
    intent: z.literal("khata.addEntry"),
    arguments: z.object({ customer: name, type: z.enum(["gave", "received"]), amountRupees: quantity.max(10000000), note: name.optional() }).strict(),
  }).strict(),
  z.object({ intent: z.literal("customer.create"), arguments: z.object({ customer: name }).strict() }).strict(),
  z.object({ intent: z.literal("khata.openAccount"), arguments: z.object({ customer: name, amountRupees: quantity.max(10000000) }).strict() }).strict(),
  z.object({ intent: z.literal("inventory.checkList"), arguments: z.object({ items: z.array(shoppingItemSchema).min(1).max(30) }).strict() }).strict(),
  z.object({ intent: z.literal("sales.recordConfirmedBasket"), arguments: z.object({
    items: z.array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(10000) }).strict()).min(1).max(30),
    paymentMethod: z.enum(["cash", "upi", "card"]),
  }).strict() }).strict(),
  z.object({
    intent: z.literal("sales.getDailySummary"),
    arguments: z.object({ date: z.iso.date() }).strict(),
  }).strict(),
  z.object({ intent: z.literal("inventory.getReorderSuggestions"), arguments: z.object({}).strict() }).strict(),
  z.object({ intent: z.literal("supplier.list"), arguments: z.object({}).strict() }).strict(),
  z.object({ intent: z.literal("supplier.create"), arguments: z.object({ name }).strict() }).strict(),
  z.object({ intent: z.literal("orders.getOpen"), arguments: z.object({}).strict() }).strict(),
  z.object({ intent: z.literal("orders.createDraft"), arguments: z.object({
    supplier: name,
    items: z.array(z.object({ product: name, quantity: z.number().int().min(1).max(10000) }).strict()).min(1).max(30),
  }).strict() }).strict(),
]);

export const reasoningResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("tool_call"), tool: toolCallSchema }).strict(),
  z.object({ kind: z.literal("clarify"), question: name, pending: z.object({ kind: z.literal("open-account-amount"), customer: name }).strict() }).strict(),
  z.object({ kind: z.literal("unsupported"), message: name }).strict(),
]);

export const pendingClarificationSchema = z.object({ kind: z.literal("open-account-amount"), customer: name }).strict();
export const recentTurnSchema = z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(500) }).strict();

export type ToolCall = z.infer<typeof toolCallSchema>;
export type ReasoningResult = z.infer<typeof reasoningResultSchema>;
