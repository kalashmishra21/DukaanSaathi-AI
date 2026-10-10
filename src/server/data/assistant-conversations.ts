import "server-only";

import { z } from "zod";
import { pendingClarificationSchema, type PendingClarification } from "@/lib/ai/types/tool-call";
import { assistantResponseSchema, type AssistantResponse } from "@/lib/business/assistant-response";
import { conversationReservationError } from "@/lib/assistant/conversation-errors";
import type { ShopContext } from "./context";

type ReadyContext = Extract<ShopContext, { kind: "ready" }>;

const threadSchema = z.object({ id: z.uuid(), title: z.string(), updated_at: z.string() });
const messageSchema = z.object({ id: z.uuid(), role: z.enum(["user", "assistant"]), text: z.string(),
  request_key: z.uuid(), result: z.unknown().nullable(), created_at: z.string() });
const reservedSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("busy") }),
  z.object({ status: z.literal("completed"), result: assistantResponseSchema }),
  z.object({ status: z.literal("reserved"), pending: pendingClarificationSchema.nullable(), pendingRequestKey: z.uuid().nullable() }),
]);

export class AssistantConversationRepository {
  constructor(private readonly context: ReadyContext) {}

  async list() {
    const { data, error } = await this.context.client.from("assistant_conversations")
      .select("id,title,updated_at").eq("shop_id", this.context.shop.id).eq("owner_id", this.context.userId)
      .order("updated_at", { ascending: false }).limit(50);
    if (error) throw new Error("Conversation history is unavailable.");
    return z.array(threadSchema).parse(data);
  }

  async create(): Promise<string> {
    const { data, error } = await this.context.client.rpc("create_assistant_conversation", { p_shop_id: this.context.shop.id });
    if (error) throw new Error("A new conversation could not be created.");
    return z.uuid().parse(data);
  }

  async load(id: string) {
    const { data: thread, error: threadError } = await this.context.client.from("assistant_conversations")
      .select("id,title,pending,updated_at").eq("id", id).eq("shop_id", this.context.shop.id)
      .eq("owner_id", this.context.userId).maybeSingle();
    if (threadError || !thread) throw new Error("Conversation not found in this shop.");
    const { data: messages, error } = await this.context.client.from("assistant_messages")
      .select("id,role,text,result,request_key,created_at").eq("conversation_id", id).eq("shop_id", this.context.shop.id)
      .order("created_at").order("id").limit(300);
    if (error) throw new Error("Conversation messages are unavailable.");
    const safeMessages = z.array(messageSchema).parse(messages).map((message) => {
      const parsed = message.result === null ? null : assistantResponseSchema.safeParse(message.result);
      return { ...message, result: parsed?.success ? parsed.data : null };
    });
    return { id: z.uuid().parse(thread.id), title: z.string().parse(thread.title),
      pending: thread.pending === null ? null : pendingClarificationSchema.parse(thread.pending), messages: safeMessages };
  }

  async rename(id: string, title: string) {
    const { data, error } = await this.context.client.from("assistant_conversations")
      .update({ title }).eq("id", id).eq("shop_id", this.context.shop.id).eq("owner_id", this.context.userId)
      .select("id").maybeSingle();
    if (error || !data) throw new Error("Conversation could not be renamed.");
  }

  async remove(id: string) {
    const { data, error } = await this.context.client.from("assistant_conversations")
      .delete().eq("id", id).eq("shop_id", this.context.shop.id).eq("owner_id", this.context.userId)
      .select("id").maybeSingle();
    if (error || !data) throw new Error("Conversation could not be deleted.");
  }

  async reserve(id: string, requestKey: string, text: string) {
    const { data, error } = await this.context.client.rpc("reserve_assistant_turn", {
      p_shop_id: this.context.shop.id, p_conversation_id: id, p_request_key: requestKey, p_text: text,
    });
    if (error) throw conversationReservationError(error.code);
    return reservedSchema.parse(data);
  }

  async getAssistantMessageId(id: string, requestKey: string): Promise<string> {
    const { data, error } = await this.context.client.from("assistant_messages")
      .select("id").eq("conversation_id", id).eq("shop_id", this.context.shop.id)
      .eq("request_key", requestKey).eq("role", "assistant").maybeSingle();
    if (error || !data) throw new Error("Saved assistant message could not be verified.");
    return z.uuid().parse(data.id);
  }

  async getSaleDraft(id: string, messageId: string) {
    const { data, error } = await this.context.client.from("assistant_messages")
      .select("result").eq("id", messageId).eq("conversation_id", id).eq("shop_id", this.context.shop.id)
      .eq("owner_id", this.context.userId).eq("role", "assistant").maybeSingle();
    if (error || !data) throw new Error("This shopping-list draft is unavailable. Check the list again.");
    const result = assistantResponseSchema.parse(data.result);
    if (result.state !== "draft" || !result.shoppingList?.canConfirm) throw new Error("This shopping list cannot be confirmed.");
    return result.shoppingList;
  }

  async complete(id: string, requestKey: string, result: AssistantResponse, pending: PendingClarification | null, pendingRequestKey: string | null) {
    // TTS bytes and temporary attachment data are deliberately excluded.
    const { speech: _speech, messageId: _messageId, ...persistable } = result;
    void _speech;
    void _messageId;
    const saved = assistantResponseSchema.omit({ speech: true }).parse(persistable);
    const { error } = await this.context.client.rpc("complete_assistant_turn", {
      p_shop_id: this.context.shop.id, p_conversation_id: id, p_request_key: requestKey,
      p_reply: saved.reply, p_result: saved, p_pending: pending, p_pending_request_key: pendingRequestKey,
    });
    if (error) throw new Error("The conversation result could not be saved. Verify store records before retrying.");
    return this.getAssistantMessageId(id, requestKey);
  }
}
