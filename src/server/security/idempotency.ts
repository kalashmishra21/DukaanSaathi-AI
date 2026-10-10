import { z } from "zod";

const requestKeySchema = z.uuid();

export function readIdempotencyKey(request: Request): string | null {
  const parsed = requestKeySchema.safeParse(request.headers.get("idempotency-key"));
  return parsed.success ? parsed.data : null;
}

export function missingIdempotencyKey(): Response {
  return Response.json(
    { error: "This request needs a valid idempotency key. Please retry from the app." },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}
