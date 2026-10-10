import { describe, expect, it } from "vitest";
import { conversationReservationError, ConversationRequestConflictError } from "../src/lib/assistant/conversation-errors";

describe("assistant conversation request keys", () => {
  it("distinguishes conflicting replay from an unavailable conversation", () => {
    expect(conversationReservationError("22023")).toBeInstanceOf(ConversationRequestConflictError);
    expect(conversationReservationError("P0002").message).toBe("Conversation not found in this shop.");
  });
});
