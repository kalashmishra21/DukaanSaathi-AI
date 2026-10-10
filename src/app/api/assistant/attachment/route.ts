import { z } from "zod";
import { parseTextShoppingList } from "@/lib/assistant/parse-text-list";
import { shoppingDraftSchema, type ShoppingItem } from "@/lib/assistant/shopping-list";
import { OpenRouterVisionExtractor, type VisionImage } from "@/lib/ai/vision/openrouter-vision";
import { readProviderConfig } from "@/lib/env/config";
import { getShopContext } from "@/server/data/context";
import { SupabaseBusinessRepository } from "@/server/data/tool-repository";
import { BusinessToolExecutor, describeToolResult } from "@/server/tools/business-executor";
import { executeValidatedToolCall } from "@/server/tools/contracts";
import { enforceShopRateLimit } from "@/server/security/rate-limit";
import { ProviderRequestError } from "@/lib/ai/provider-http";

const textSchema = z.string().max(6000);
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function matchesSignature(mimeType: string, bytes: Uint8Array): mimeType is VisionImage["mimeType"] {
  if (mimeType === "image/png") return bytes.length > 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((part, index) => bytes[index] === part);
  if (mimeType === "image/jpeg") return bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217;
  if (mimeType === "image/webp") return bytes.length > 12 && Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP";
  return false;
}

export async function POST(request: Request) {
  const context = await getShopContext();
  if (context.kind === "signed-out") return Response.json({ error: "Sign in to check store inventory." }, { status: 401 });
  if (context.kind !== "ready") return Response.json({ error: "Connect your shop before checking a list." }, { status: 409 });
  const attachmentLimit = await enforceShopRateLimit(context, "assistant_attachment");
  if (attachmentLimit) return attachmentLimit;

  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "Attach a valid image or PDF list." }, { status: 400 }); }
  const textResult = textSchema.safeParse(form.get("extractedText") ?? "");
  if (!textResult.success) return Response.json({ error: "The extracted document is too long." }, { status: 413 });
  const files = form.getAll("images");
  if (files.length > 3 || files.some((file) => !(file instanceof File) || !imageTypes.has(file.type) || file.size > 5_000_000 || file.size === 0)) {
    return Response.json({ error: "Attach up to three JPG, PNG or WebP images, each under 5 MB." }, { status: 413 });
  }
  if (!textResult.data.trim() && !files.length) return Response.json({ error: "The attachment contains no readable list." }, { status: 422 });

  const images: VisionImage[] = [];
  for (const file of files as File[]) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesSignature(file.type, bytes)) return Response.json({ error: "The image format does not match its file type." }, { status: 422 });
    images.push({ mimeType: file.type, bytes });
  }
  let items: ShoppingItem[] = [];
  try {
    if (textResult.data.trim()) items = parseTextShoppingList(textResult.data);
    if (images.length) {
      if (!process.env.OPENROUTER_API_KEY?.trim()) return Response.json({ error: "Image reading is not configured. Text PDFs can still be checked." }, { status: 503 });
      const visionLimit = await enforceShopRateLimit(context, "openrouter_vision");
      if (visionLimit) return visionLimit;
      const visionConfig = readProviderConfig();
      const vision = new OpenRouterVisionExtractor(process.env.OPENROUTER_API_KEY, visionConfig.OPENROUTER_VISION_MODEL,
        fetch, visionConfig.OPENROUTER_VISION_FALLBACK_MODELS);
      items = [...items, ...await vision.extract(images)];
    }
    const result = await executeValidatedToolCall({ intent: "inventory.checkList", arguments: { items } },
      new BusinessToolExecutor(new SupabaseBusinessRepository(context)));
    if ("clarification" in result) return Response.json({ error: "The shopping list needs clarification. No list or sale was created." }, { status: 422 });
    if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
    const draft = shoppingDraftSchema.parse((result.data as { draft: unknown }).draft);
    return Response.json({ state: "draft", intent: "inventory.checkList", ...describeToolResult(result), shoppingList: draft });
  } catch (error) {
    if (error instanceof ProviderRequestError) {
      return Response.json(
        { error: error.status === 429 ? "Image reading is busy. Please wait and retry; no list or sale was created." : "Image reading is unavailable. No list or sale was created." },
        { status: error.status === 429 ? 429 : 503, headers: error.status === 429 ? { "Retry-After": error.retryAfter ?? "2" } : undefined },
      );
    }
    const message = error instanceof Error && /^(Vision model|Vision providers|The vision model|The list repeats)/.test(error.message)
      ? error.message : "The list could not be read safely. Check the file and try again.";
    return Response.json({ error: message }, { status: message.startsWith("Vision providers") ? 503 : 422 });
  }
}
