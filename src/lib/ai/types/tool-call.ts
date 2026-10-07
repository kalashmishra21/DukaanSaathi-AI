import { z } from "zod";

const name = z.string().trim().min(1).max(120);
const quantity = z.number().int().positive();

export const toolCallSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("inventory.adjust"),
    arguments: z.object({ product: name, delta: z.number().int().refine((value) => value !== 0) }).strict(),
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
    arguments: z.object({ customer: name, amountRupees: quantity, note: name.optional() }).strict(),
  }).strict(),
  z.object({
    intent: z.literal("sales.getDailySummary"),
    arguments: z.object({ date: z.iso.date() }).strict(),
  }).strict(),
]);

export const reasoningResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("tool_call"), tool: toolCallSchema }).strict(),
  z.object({ kind: z.literal("unsupported"), message: name }).strict(),
]);

export type ToolCall = z.infer<typeof toolCallSchema>;
export type ReasoningResult = z.infer<typeof reasoningResultSchema>;
