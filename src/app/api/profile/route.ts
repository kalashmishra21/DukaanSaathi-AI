import { getShopContext } from "@/server/data/context";
import { profileUpdateSchema } from "@/lib/auth/profile-schema";

export async function GET() {
  const context = await getShopContext();
  if (context.kind === "signed-out") return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (context.kind === "setup" || context.kind === "unavailable") return Response.json({ error: "Account details are unavailable. Try again." }, { status: 503 });
  const [{ data: account, error: authError }, { data: profile, error: profileError }] = await Promise.all([
    context.client.auth.getUser(),
    context.client.from("profiles").select("display_name").eq("id", context.userId).maybeSingle(),
  ]);
  if (authError || !account.user || profileError) return Response.json({ error: "Account details are unavailable. Try again." }, { status: 503 });
  return Response.json({
    displayName: profile?.display_name || account.user.user_metadata?.display_name || "",
    email: account.user.email || "",
    shop: context.kind === "ready" ? { id: context.shop.id, name: context.shop.name, currency: "INR", demo: context.shop.name === "DukaanSaathi Demo Mart" } : null,
  });
}

export async function PATCH(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: "Send a valid update." }, { status: 400 }); }
  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Use 2–80 characters for your name or 2–120 for a shop name." }, { status: 422 });
  const context = await getShopContext();
  if (context.kind === "signed-out") return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (context.kind === "setup" || context.kind === "unavailable") return Response.json({ error: "Account details are unavailable. Try again." }, { status: 503 });

  if (parsed.data.field === "displayName") {
    const { data, error } = await context.client.from("profiles").update({ display_name: parsed.data.value })
      .eq("id", context.userId).select("display_name").maybeSingle();
    if (error || !data) return Response.json({ error: "Your name could not be saved. Please try again." }, { status: 503 });
    return Response.json({ ok: true, value: data.display_name });
  }

  if (context.kind !== "ready") return Response.json({ error: "Create a shop before editing its name." }, { status: 409 });
  if (context.shop.name === "DukaanSaathi Demo Mart") return Response.json({ error: "The demo shop name is fixed so reset and reseed stay reliable." }, { status: 403 });
  const { data, error } = await context.client.from("shops").update({ name: parsed.data.value })
    .eq("id", context.shop.id).eq("owner_id", context.userId).select("name").maybeSingle();
  if (error || !data) return Response.json({ error: "The shop name could not be saved. Check whether it is already in use." }, { status: 503 });
  return Response.json({ ok: true, value: data.name });
}
