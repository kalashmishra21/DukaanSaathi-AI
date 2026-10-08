import { z } from "zod";

export const assistantResponseSchema = z.object({
  state: z.enum(["preview", "confirmed", "failed", "unsupported"]),
  title: z.string(),
  intent: z.string(),
  detail: z.string(),
  reply: z.string(),
}).strict();

export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
