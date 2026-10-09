import { z } from "zod";
import { createAIProvider } from "@/lib/ai/provider";
import { pendingClarificationSchema, reasoningResultSchema, recentTurnSchema } from "@/lib/ai/types/tool-call";
import { shoppingDraftSchema } from "@/lib/assistant/shopping-list";
import { readProviderConfig } from "@/lib/env/config";
import { describeMockTurn } from "@/features/assistant/mock-turn";
import { getShopContext } from "@/server/data/context";
import { SupabaseBusinessRepository } from "@/server/data/tool-repository";
import { BusinessToolExecutor, describeToolResult } from "@/server/tools/business-executor";
import { executeValidatedToolCall } from "@/server/tools/contracts";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(500),
  speak: z.boolean().default(false),
  recent: z.array(recentTurnSchema).max(6).default([]),
  pending: pendingClarificationSchema.nullable().optional(),
}).strict();

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Enter a valid request." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Enter a request between 1 and 500 characters." }, { status: 400 });

  const context = await getShopContext();
  if (context.kind === "signed-out") return Response.json({ error: "Sign in to use trusted store tools." }, { status: 401 });
  if (context.kind === "unavailable") return Response.json({ error: "Store data is temporarily unavailable. Nothing was changed." }, { status: 503 });

  let provider;
  try { provider = createAIProvider(); } catch {
    return Response.json({ error: "The selected AI provider is not configured. Nothing was changed." }, { status: 503 });
  }
  let reasoning;
  try { reasoning = reasoningResultSchema.parse(await provider.reason({ text: parsed.data.text, recent: parsed.data.recent, pending: parsed.data.pending })); }
  catch (error) {
    console.warn("Assistant reasoning rejected:", error instanceof Error && /^OpenRouter /.test(error.message) ? error.message : error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "The request could not be safely interpreted. Nothing was changed." }, { status: 503 });
  }
  const preview = describeMockTurn(reasoning);
  if (reasoning.kind === "clarify") return Response.json({ state: "clarify", title: "One detail needed",
    intent: reasoning.intent ?? "khata.openAccount",
    detail: reasoning.pending ? "No customer or ledger entry has been created." : "No store action has been taken.",
    reply: reasoning.question, ...(reasoning.pending ? { pending: reasoning.pending } : {}) });
  if (reasoning.kind === "unsupported") return Response.json({ state: "unsupported", ...preview });
  if (context.kind === "setup" || context.kind === "no-shop") return Response.json({ state: "preview", ...preview });

  const executor = new BusinessToolExecutor(new SupabaseBusinessRepository(context));
  const result = await executeValidatedToolCall(reasoning.tool, executor);
  const description = describeToolResult(result);
  const shoppingList = result.ok && reasoning.tool.intent === "inventory.checkList"
    ? shoppingDraftSchema.parse((result.data as { draft: unknown }).draft) : undefined;
  const answer = { state: result.ok ? shoppingList ? "draft" : "confirmed" : "failed", intent: reasoning.tool.intent, ...description, shoppingList };

  // Business confirmation is formed from the trusted result before speech is
  // requested. A TTS failure cannot turn a failed tool into a success claim.
  if (parsed.data.speak && readProviderConfig().AI_PROVIDER === "gnani") {
    try {
      const speech = await provider.synthesize(answer.reply);
      if (speech.kind === "audio") {
        return Response.json({ ...answer, speech: { mimeType: speech.mimeType, data: Buffer.from(speech.bytes).toString("base64") } },
          { status: result.ok ? 200 : 409 });
      }
    } catch {
      return Response.json({ ...answer, speechUnavailable: true }, { status: result.ok ? 200 : 409 });
    }
  }
  return Response.json(answer, { status: result.ok ? 200 : 409 });
}
