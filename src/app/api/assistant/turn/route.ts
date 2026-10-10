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
import { readIdempotencyKey, missingIdempotencyKey } from "@/server/security/idempotency";
import { enforceShopRateLimit } from "@/server/security/rate-limit";
import { ProviderRequestError } from "@/lib/ai/provider-http";
import { isClarificationCancel } from "@/lib/assistant/merchant-language";

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
  const idempotencyKey = readIdempotencyKey(request);
  if (!idempotencyKey) return missingIdempotencyKey();

  const context = await getShopContext();
  if (context.kind === "signed-out") return Response.json({ error: "Sign in to use trusted store tools." }, { status: 401 });
  if (context.kind === "unavailable") return Response.json({ error: "Store data is temporarily unavailable. Nothing was changed." }, { status: 503 });

  let config;
  try { config = readProviderConfig(); } catch {
    return Response.json({ error: "The AI provider configuration is invalid. Nothing was changed." }, { status: 503 });
  }
  if (context.kind === "setup" && (config.AI_PROVIDER !== "mock" || config.AI_REASONER !== "mock")) {
    return Response.json({ error: "Live AI requests require a signed-in shop and distributed request protection." }, { status: 503 });
  }
  const assistantLimit = await enforceShopRateLimit(context, "assistant_turn");
  if (assistantLimit) return assistantLimit;
  if (config.AI_REASONER === "openrouter") {
    const reasonerLimit = await enforceShopRateLimit(context, "openrouter_reasoner");
    if (reasonerLimit) return reasonerLimit;
  }
  if (parsed.data.speak && config.AI_PROVIDER === "gnani") {
    const speechLimit = await enforceShopRateLimit(context, "assistant_speech");
    if (speechLimit) return speechLimit;
  }

  const repository = context.kind === "ready" ? new SupabaseBusinessRepository(context) : null;
  let savedClarification: Awaited<ReturnType<SupabaseBusinessRepository["pendingClarification"]>> = null;
  if (repository) {
    try { savedClarification = await repository.pendingClarification(); }
    catch { return Response.json({ error: "Assistant follow-up context is unavailable. Nothing was changed." }, { status: 503 }); }
  }
  // For a connected shop, the database is authoritative. The optional body field
  // remains only for the credential-free mock preview and no-shop setup screen.
  const pending = savedClarification?.pending ?? (repository ? null : parsed.data.pending ?? null);
  const requestKey = savedClarification?.requestKey ?? idempotencyKey;
  if (pending && isClarificationCancel(parsed.data.text)) {
    if (repository) {
      try { await repository.clearPendingClarification(); }
      catch { return Response.json({ error: "The pending request could not be cleared. No store action was taken." }, { status: 503 }); }
    }
    return Response.json({ state: "unsupported", title: "Request cancelled", intent: "clarification.cancel",
      detail: "No store action was taken.", reply: "Cancelled. Nothing was saved or changed." });
  }

  let provider;
  try { provider = createAIProvider(); } catch {
    return Response.json({ error: "The selected AI provider is not configured. Nothing was changed." }, { status: 503 });
  }
  let reasoning;
  try { reasoning = reasoningResultSchema.parse(await provider.reason({ text: parsed.data.text, recent: parsed.data.recent, pending })); }
  catch (error) {
    if (error instanceof ProviderRequestError) {
      return Response.json(
        { error: error.status === 429 ? "The AI service is busy. Please wait and try again; nothing was changed." : "The AI service is temporarily unavailable. Nothing was changed." },
        { status: error.status === 429 ? 429 : 503, headers: error.status === 429 ? { "Retry-After": error.retryAfter ?? "2" } : undefined },
      );
    }
    console.warn("Assistant reasoning rejected:", error instanceof Error && /^OpenRouter /.test(error.message) ? error.message : error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "The request could not be safely interpreted. Nothing was changed." }, { status: 503 });
  }
  const preview = describeMockTurn(reasoning);
  if (reasoning.kind === "clarify") {
    if (repository && reasoning.pending) {
      try { await repository.savePendingClarification(reasoning.pending, requestKey); }
      catch { return Response.json({ error: "The follow-up could not be safely saved. Nothing was changed." }, { status: 503 }); }
    }
    return Response.json({ state: "clarify", title: "One detail needed", intent: reasoning.intent ?? "assistant.clarification",
      detail: "No store action has been taken.", reply: reasoning.question, ...(reasoning.pending ? { pending: reasoning.pending } : {}) });
  }
  if (reasoning.kind === "unsupported") return Response.json({ state: "unsupported", ...preview });
  if (context.kind === "setup" || context.kind === "no-shop") return Response.json({ state: "preview", ...preview });

  if (!repository) return Response.json({ error: "Store data is temporarily unavailable. Nothing was changed." }, { status: 503 });
  const executor = new BusinessToolExecutor(repository, requestKey);
  const result = await executeValidatedToolCall(reasoning.tool, executor);
  if ("clarification" in result) {
    try { await repository.savePendingClarification(result.clarification.pending, requestKey); }
    catch { return Response.json({ error: "The needed confirmation could not be safely saved. No store action was taken." }, { status: 503 }); }
    return Response.json({ state: "clarify", title: "One detail needed", intent: reasoning.tool.intent,
      detail: "No store action has been taken.", reply: result.clarification.question, pending: result.clarification.pending });
  }
  const description = describeToolResult(result);
  const shoppingList = result.ok && reasoning.tool.intent === "inventory.checkList"
    ? shoppingDraftSchema.parse((result.data as { draft: unknown }).draft) : undefined;
  const answer = { state: result.ok ? shoppingList ? "draft" : "confirmed" : "failed", intent: reasoning.tool.intent, ...description, shoppingList };

  if (savedClarification && result.ok) {
    try { await repository.clearPendingClarification(); }
    catch { console.warn("Assistant action saved; pending clarification cleanup will need retry."); }
  }

  // Business confirmation is formed from the trusted result before speech is
  // requested. A TTS failure cannot turn a failed tool into a success claim.
  if (parsed.data.speak && config.AI_PROVIDER === "gnani") {
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
