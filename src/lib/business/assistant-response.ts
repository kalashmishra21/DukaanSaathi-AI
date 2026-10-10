import { z } from "zod";
import { shoppingDraftSchema } from "../assistant/shopping-list";
import { pendingClarificationSchema } from "../ai/types/tool-call";

export const assistantResponseSchema = z.object({
  state: z.enum(["preview", "confirmed", "failed", "unsupported", "clarify", "draft"]),
  title: z.string(),
  intent: z.string(),
  detail: z.string(),
  reply: z.string(),
  pending: pendingClarificationSchema.optional(),
  shoppingList: shoppingDraftSchema.optional(),
  messageId: z.uuid().optional(),
  sourceDraftId: z.uuid().optional(),
  speech: z.object({ mimeType: z.literal("audio/wav"), data: z.string().min(1) }).strict().optional(),
  speechUnavailable: z.boolean().optional(),
}).strict();

export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
