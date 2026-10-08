import { z } from "zod";

export const assistantResponseSchema = z.object({
  state: z.enum(["preview", "confirmed", "failed", "unsupported"]),
  title: z.string(),
  intent: z.string(),
  detail: z.string(),
  reply: z.string(),
  speech: z.object({ mimeType: z.literal("audio/wav"), data: z.string().min(1) }).strict().optional(),
  speechUnavailable: z.boolean().optional(),
}).strict();

export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
