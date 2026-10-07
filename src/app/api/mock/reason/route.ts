import { z } from "zod";
import { createAIProvider } from "@/lib/ai/provider";

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
  const result = await provider.reason({ text: parsed.data.text });
  return Response.json(result);
}
