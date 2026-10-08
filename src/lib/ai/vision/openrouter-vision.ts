import { z } from "zod";
import { shoppingExtractionSchema, type ShoppingItem } from "../../assistant/shopping-list";

export type VisionImage = { mimeType: "image/jpeg" | "image/png" | "image/webp"; bytes: Uint8Array };
const endpoint = "https://openrouter.ai/api/v1/chat/completions";
const completionSchema = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) });
const providerErrorSchema = z.object({ error: z.object({ code: z.union([z.string(), z.number()]).optional() }).passthrough() });
const wait = (duration: number) => new Promise<void>((resolve) => setTimeout(resolve, duration));

function parseItems(content: string): ShoppingItem[] {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let json: unknown;
  try { json = JSON.parse(cleaned); } catch { throw new Error("The vision model did not return a usable item list."); }
  return shoppingExtractionSchema.parse(json).items;
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export class OpenRouterVisionExtractor {
  constructor(
    private readonly key: string,
    private readonly model: string,
    private readonly request: typeof fetch = fetch,
    private readonly fallbackModels: string[] = [],
    private readonly delay: (duration: number) => Promise<void> = wait,
  ) {}

  async extract(images: VisionImage[]): Promise<ShoppingItem[]> {
    if (!images.length || images.length > 3 || images.some((image) => !image.bytes.length || image.bytes.length > 5_000_000)) {
      throw new Error("Attach one to three small shopping-list images.");
    }
    const models = [...new Set([this.model, ...this.fallbackModels])];
    if (models.length > 3 || models.some((model) => !model.endsWith(":free"))) {
      throw new Error("Vision model configuration must use at most three free models.");
    }
    const messages = [
      { role: "system", content: "Read the Indian shop shopping list. Return ONLY JSON: {\"items\":[{\"product\":\"name\",\"quantity\":1}]}. Exclude headings, convert Hindi digits to integers, and never invent items. Use the written brand name. If text matches Maggi, Parle-G, Tata Salt, Amul Milk, Surf Excel, Good Day, Aashirvaad Atta or Tata Tea, use that exact spelling." },
      { role: "user", content: [
        { type: "text", text: "Extract item names and quantities from the attached shopping-list image or pages." },
        ...images.map((image) => ({ type: "image_url", image_url: { url: `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString("base64")}` } })),
      ] },
    ];
    const deadline = Date.now() + 45_000;
    for (const model of models) {
      const body = JSON.stringify({ model, messages, temperature: 0, max_tokens: 700, stream: false });
      for (let attempt = 0; attempt < 2; attempt++) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        try {
          const response = await this.request(endpoint, {
            method: "POST",
            headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
            body, signal: AbortSignal.timeout(Math.min(15_000, remaining)), cache: "no-store",
          });
          if (!response.ok) {
            if (response.status === 401 || response.status === 403) throw new Error("Vision provider authorization failed.");
            if (response.status === 404) break; // Retired model: try the next configured provider immediately.
            if (!retryableStatus(response.status)) throw new Error(`Vision request was rejected (${response.status}).`);
          } else {
            const raw: unknown = await response.json();
            const providerError = providerErrorSchema.safeParse(raw);
            if (!providerError.success) {
              const parsed = completionSchema.safeParse(raw);
              if (!parsed.success) break;
              try { return parseItems(parsed.data.choices[0].message.content); } catch { break; }
            }
            const code = Number(providerError.data.error.code);
            if (code === 401 || code === 403) throw new Error("Vision provider authorization failed.");
            if (code === 404 || (Number.isFinite(code) && !retryableStatus(code))) break;
          }
        } catch (error) {
          if (error instanceof Error && /^(Vision provider authorization|Vision request was rejected)/.test(error.message)) throw error;
          // A timeout or transient network failure can be retried on another free provider.
        }
        if (attempt === 0 && Date.now() + 700 < deadline) await this.delay(700);
      }
    }
    throw new Error("Vision providers are temporarily unavailable. No list was created; try a text PDF or type the items.");
  }
}
