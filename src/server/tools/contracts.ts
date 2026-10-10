import { toolCallSchema, type PendingClarification, type ToolCall } from "../../lib/ai/types/tool-call";

export type ToolExecutionResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string }
  | { ok: false; clarification: { question: string; pending: PendingClarification } };

export interface TrustedToolExecutor {
  execute(call: ToolCall): Promise<ToolExecutionResult>;
}

/** Validate model output before any trusted tool sees it. */
export async function executeValidatedToolCall(
  candidate: unknown,
  executor: TrustedToolExecutor,
): Promise<ToolExecutionResult> {
  const call = toolCallSchema.parse(candidate);
  return executor.execute(call);
}
