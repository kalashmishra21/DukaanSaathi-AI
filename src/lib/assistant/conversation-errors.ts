export class ConversationRequestConflictError extends Error {
  constructor() { super("This request key was already used for different content."); }
}

export function conversationReservationError(code: string): Error {
  if (code === "22023") return new ConversationRequestConflictError();
  return new Error(code === "P0002" ? "Conversation not found in this shop." : "Conversation could not be reserved.");
}
