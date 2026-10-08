import { z } from "zod";
import { createAIProvider } from "@/lib/ai/provider";
import { reasoningResultSchema } from "@/lib/ai/types/tool-call";
import { describeMockTurn } from "@/features/assistant/mock-turn";
import { getShopContext } from "@/server/data/context";
import { SupabaseBusinessRepository } from "@/server/data/tool-repository";
import { BusinessToolExecutor, describeToolResult } from "@/server/tools/business-executor";
import { executeValidatedToolCall } from "@/server/tools/contracts";

const requestSchema = z.object({ text: z.string().trim().min(1).max(500) }).strict();

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter a valid request." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Enter a request between 1 and 500 characters." }, { status: 400 });
  }

  const provider = createAIProvider();
  const reasoning = reasoningResultSchema.parse(await provider.reason({ text: parsed.data.text }));
  const preview = describeMockTurn(reasoning);
  if (reasoning.kind === "unsupported") return Response.json({ state: "unsupported", ...preview });

  const context = await getShopContext();
  if (context.kind === "setup" || context.kind === "no-shop") return Response.json({ state: "preview", ...preview });
  if (context.kind === "signed-out") return Response.json({ error: "Sign in to use trusted store tools." }, { status: 401 });
  if (context.kind === "unavailable") return Response.json({ error: "Store data is temporarily unavailable. Nothing was changed." }, { status: 503 });

  const executor = new BusinessToolExecutor(new SupabaseBusinessRepository(context));
  const result = await executeValidatedToolCall(reasoning.tool, executor);
  const description = describeToolResult(result);
  return Response.json({
    state: result.ok ? "confirmed" : "failed",
    intent: reasoning.tool.intent,
    ...description,
  }, { status: result.ok ? 200 : 409 });
}
