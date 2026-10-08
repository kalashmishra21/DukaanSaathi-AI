import { z } from "zod";
import { createAIProvider } from "@/lib/ai/provider";
import { reasoningResultSchema } from "@/lib/ai/types/tool-call";
import { readProviderConfig } from "@/lib/env/config";
import { describeMockTurn } from "@/features/assistant/mock-turn";
import { getShopContext } from "@/server/data/context";
import { SupabaseBusinessRepository } from "@/server/data/tool-repository";
import { BusinessToolExecutor, describeToolResult } from "@/server/tools/business-executor";
import { executeValidatedToolCall } from "@/server/tools/contracts";

const requestSchema = z.object({ text: z.string().trim().min(1).max(500), speak: z.boolean().default(false) }).strict();

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
  const reasoning = reasoningResultSchema.parse(await provider.reason({ text: parsed.data.text }));
  const preview = describeMockTurn(reasoning);
  if (reasoning.kind === "unsupported") return Response.json({ state: "unsupported", ...preview });
  if (context.kind === "setup" || context.kind === "no-shop") return Response.json({ state: "preview", ...preview });

  const executor = new BusinessToolExecutor(new SupabaseBusinessRepository(context));
  const result = await executeValidatedToolCall(reasoning.tool, executor);
  const description = describeToolResult(result);
  const answer = { state: result.ok ? "confirmed" : "failed", intent: reasoning.tool.intent, ...description };

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
