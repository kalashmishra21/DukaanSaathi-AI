import { describe, expect, it } from "vitest";
import { ProviderRequestError, retryAfterSeconds, retryProviderRequest } from "../src/lib/ai/provider-http";

describe("bounded provider retry and failure handling", () => {
  it("retries a transient provider response once and returns the successful response", async () => {
    let calls = 0;
    const delays: number[] = [];
    const response = await retryProviderRequest(async () => {
      calls += 1;
      return calls === 1 ? new Response(null, { status: 503 }) : Response.json({ ok: true });
    }, { wait: async (duration) => { delays.push(duration); } });

    expect(calls).toBe(2);
    expect(delays).toEqual([250]);
    expect(response.status).toBe(200);
  });

  it("honors a long Retry-After without sleeping past the bounded retry budget", async () => {
    let calls = 0;
    const delays: number[] = [];
    const response = await retryProviderRequest(async () => {
      calls += 1;
      return new Response(null, { status: 429, headers: { "Retry-After": "8" } });
    }, { wait: async (duration) => { delays.push(duration); } });

    expect(calls).toBe(1);
    expect(delays).toEqual([]);
    expect(response.status).toBe(429);
    expect(retryAfterSeconds(response.headers.get("Retry-After"))).toBe(8);
  });

  it("retries one network failure and does not retry a second failure indefinitely", async () => {
    let calls = 0;
    await expect(retryProviderRequest(async () => {
      calls += 1;
      throw new TypeError("network unavailable");
    }, { wait: async () => undefined })).rejects.toThrow("network unavailable");
    expect(calls).toBe(2);
  });

  it("retains provider status and retry guidance without exposing response bodies", () => {
    const failure = new ProviderRequestError("OpenRouter", 429, "3");
    expect(failure).toMatchObject({ status: 429, retryAfter: "3" });
    expect(failure.message).toBe("OpenRouter request failed (429).");
  });
});
