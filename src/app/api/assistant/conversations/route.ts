import { z } from "zod";
import { getShopContext } from "@/server/data/context";
import { AssistantConversationRepository } from "@/server/data/assistant-conversations";
import { enforceShopRateLimit } from "@/server/security/rate-limit";

const uuid = z.uuid();
const renameSchema = z.object({ id: uuid, title: z.string().trim().min(1).max(80) }).strict();
const deleteSchema = z.object({ id: uuid }).strict();

async function repository() {
  const context = await getShopContext();
  return context.kind === "ready" ? { context, store: new AssistantConversationRepository(context) } : null;
}

export async function GET(request: Request) {
  const access = await repository();
  if (!access) return Response.json({ error: "Sign in and open a shop to view conversations." }, { status: 401 });
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id) return Response.json(await access.store.load(uuid.parse(id)));
    return Response.json({ conversations: await access.store.list() });
  } catch {
    return Response.json({ error: "Conversation history is unavailable." }, { status: 503 });
  }
}

export async function POST() {
  const access = await repository();
  if (!access) return Response.json({ error: "Sign in and open a shop first." }, { status: 401 });
  const limited = await enforceShopRateLimit(access.context, "business_action");
  if (limited) return limited;
  try { return Response.json({ id: await access.store.create() }, { status: 201 }); }
  catch { return Response.json({ error: "Conversation could not be created." }, { status: 503 }); }
}

export async function PATCH(request: Request) {
  const access = await repository();
  if (!access) return Response.json({ error: "Sign in and open a shop first." }, { status: 401 });
  const parsed = renameSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a conversation title up to 80 characters." }, { status: 400 });
  const limited = await enforceShopRateLimit(access.context, "business_action");
  if (limited) return limited;
  try { await access.store.rename(parsed.data.id, parsed.data.title); return Response.json({ ok: true }); }
  catch { return Response.json({ error: "Conversation could not be renamed." }, { status: 404 }); }
}

export async function DELETE(request: Request) {
  const access = await repository();
  if (!access) return Response.json({ error: "Sign in and open a shop first." }, { status: 401 });
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a valid conversation." }, { status: 400 });
  const limited = await enforceShopRateLimit(access.context, "business_action");
  if (limited) return limited;
  try { await access.store.remove(parsed.data.id); return Response.json({ ok: true }); }
  catch { return Response.json({ error: "Conversation could not be deleted." }, { status: 404 }); }
}
