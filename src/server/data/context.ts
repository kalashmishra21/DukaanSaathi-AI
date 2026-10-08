import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Client = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
export type ShopContext =
  | { kind: "setup" }
  | { kind: "signed-out" }
  | { kind: "unavailable" }
  | { kind: "no-shop"; client: Client; userId: string }
  | { kind: "ready"; client: Client; userId: string; shop: { id: string; name: string } };

export const getShopContext = cache(async function getShopContext(): Promise<ShopContext> {
  const client = await createSupabaseServerClient();
  if (!client) return { kind: "setup" };
  try {
    const { data: claims, error: authError } = await client.auth.getClaims();
    if (authError || !claims?.claims?.sub) return { kind: "signed-out" };
    const userId = claims.claims.sub;
    const { data: shop, error } = await client.from("shops")
      .select("id,name").eq("owner_id", userId).order("created_at").limit(1).maybeSingle();
    if (error) return { kind: "unavailable" };
    if (!shop) return { kind: "no-shop", client, userId };
    return { kind: "ready", client, userId, shop };
  } catch {
    return { kind: "unavailable" };
  }
});
