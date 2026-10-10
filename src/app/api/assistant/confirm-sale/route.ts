import { z } from "zod";
import { toolCallSchema } from "@/lib/ai/types/tool-call";
import { getShopContext } from "@/server/data/context";
import { SupabaseBusinessRepository } from "@/server/data/tool-repository";
import { BusinessToolExecutor, describeToolResult } from "@/server/tools/business-executor";
import { executeValidatedToolCall } from "@/server/tools/contracts";
import { enforceShopRateLimit } from "@/server/security/rate-limit";
import { missingIdempotencyKey, readIdempotencyKey } from "@/server/security/idempotency";

const requestSchema = z.object({
  confirmed: z.literal(true),
  items: z.array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(10000) }).strict()).min(1).max(30),
  paymentMethod: z.enum(["cash", "upi", "card"]),
}).strict();

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: "Confirm a valid basket." }, { status: 400 }); }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Review the basket before confirming the sale." }, { status: 422 });
  const requestKey = readIdempotencyKey(request);
  if (!requestKey) return missingIdempotencyKey();
  const context = await getShopContext();
  if (context.kind === "signed-out") return Response.json({ error: "Sign in before confirming a sale." }, { status: 401 });
  if (context.kind !== "ready") return Response.json({ error: "Connect a shop before confirming a sale." }, { status: 409 });
  const rateLimited = await enforceShopRateLimit(context, "business_action");
  if (rateLimited) return rateLimited;

  const call = toolCallSchema.parse({ intent: "sales.recordConfirmedBasket", arguments: {
    items: parsed.data.items, paymentMethod: parsed.data.paymentMethod,
  } });
  const result = await executeValidatedToolCall(call, new BusinessToolExecutor(new SupabaseBusinessRepository(context), requestKey));
  return Response.json({ state: result.ok ? "confirmed" : "failed", intent: call.intent, ...describeToolResult(result) },
    { status: result.ok ? 200 : 409 });
}
