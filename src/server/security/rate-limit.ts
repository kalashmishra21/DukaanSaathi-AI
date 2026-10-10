import "server-only";

import { z } from "zod";
import type { ShopContext } from "@/server/data/context";

export type RateLimitBucket =
  | "assistant_turn"
  | "assistant_speech"
  | "assistant_attachment"
  | "gnani_transcribe"
  | "openrouter_reasoner"
  | "openrouter_vision"
  | "business_action";

const resultSchema = z.array(z.object({
  allowed: z.boolean(),
  retry_after_seconds: z.number().int().min(1).max(60),
})).length(1);

/**
 * Distributed database-backed limit. Failing closed prevents an unavailable
 * limiter from silently disabling provider and attachment quotas.
 */
export async function enforceShopRateLimit(
  context: ShopContext,
  bucket: RateLimitBucket,
): Promise<Response | null> {
  if (context.kind !== "ready" && context.kind !== "no-shop") return null;
  try {
    const { data, error } = await context.client.rpc("consume_shop_rate_limit", {
      p_shop_id: context.kind === "ready" ? context.shop.id : null,
      p_bucket: bucket,
    });
    if (error) throw new Error("Rate limiter unavailable");
    const [result] = resultSchema.parse(data);
    if (result.allowed) return null;
    return Response.json(
      { error: "Too many requests. Please wait a moment and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retry_after_seconds),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Request protection is temporarily unavailable. Please try again shortly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
