import { z } from "zod";
import { shoppingExtractionSchema, type ShoppingItem } from "../../assistant/shopping-list";

export type VisionImage = { mimeType: "image/jpeg" | "image/png" | "image/webp"; bytes: Uint8Array };
const endpoint = "https://openrouter.ai/api/v1/chat/completions";
const completionSchema = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) });

function parseItems(content: string): ShoppingItem[] {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let json: unknown;
  try { json = JSON.parse(cleaned); } catch { throw new Error("The vision model did not return a usable item list."); }
  return shoppingExtractionSchema.parse(json).items;
}

export class OpenRouterVisionExtractor {
  constructor(private readonly key: string, private readonly model: string, private readonly request: typeof fetch = fetch) {}

  async extract(images: VisionImage[]): Promise<ShoppingItem[]> {
    if (!images.length || images.length > 3 || images.some((image) => !image.bytes.length || image.bytes.length > 5_000_000)) {
      throw new Error("Attach one to three small shopping-list images.");
    }
    const body = JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: "Read the Indian shop shopping list. Return ONLY JSON: {\"items\":[{\"product\":\"name\",\"quantity\":1}]}. Exclude headings, convert Hindi digits to integers, and never invent items. Use the written brand name. If text matches Maggi, Parle-G, Tata Salt, Amul Milk, Surf Excel, Good Day, Aashirvaad Atta or Tata Tea, use that exact spelling." },
          { role: "user", content: [
            { type: "text", text: "Extract item names and quantities from the attached shopping-list image or pages." },
            ...images.map((image) => ({ type: "image_url", image_url: { url: `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString("base64")}` } })),
          ] },
        ],
        temperature: 0, max_tokens: 700, stream: false,
      });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await this.request(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body, signal: AbortSignal.timeout(45_000), cache: "no-store",
      });
      if (!response.ok) {
        if (attempt === 0 && [429, 502, 503].includes(response.status)) {
          await new Promise((resolve) => setTimeout(resolve, 750));
          continue;
        }
        throw new Error(`Vision model unavailable (${response.status}).`);
      }
      const raw: unknown = await response.json();
      if (z.object({ error: z.unknown() }).safeParse(raw).success) {
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 750));
          continue;
        }
        throw new Error("Vision model provider is temporarily unavailable.");
      }
      const parsed = completionSchema.safeParse(raw);
      if (!parsed.success) throw new Error("Vision model returned an invalid response.");
      return parseItems(parsed.data.choices[0].message.content);
    }
    throw new Error("Vision model provider is temporarily unavailable.");
  }
}
