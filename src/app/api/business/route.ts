import { businessActionSchema, saleSchema } from "@/lib/business/schemas";
import { getShopContext } from "@/server/data/context";

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return Response.json({ error: "Send a valid request." }, { status: 400 });
  }
  const parsed = businessActionSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Check the entered values and try again." }, { status: 422 });

  const context = await getShopContext();
  if (context.kind === "setup") return Response.json({ error: "Connect Supabase to use store data." }, { status: 503 });
  if (context.kind === "signed-out") return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (context.kind === "unavailable") return Response.json({ error: "Store data is temporarily unavailable." }, { status: 503 });

  const action = parsed.data;
  if (action.kind === "shop.seed") {
    if (context.kind !== "no-shop") return Response.json({ error: "A shop is already connected." }, { status: 409 });
    const { data, error } = await context.client.rpc("bootstrap_demo_shop");
    if (error) return databaseError(error);
    return Response.json({ ok: true, shopId: data });
  }
  if (context.kind !== "ready") return Response.json({ error: "Create your demo shop first." }, { status: 409 });
  const { client, shop } = context;

  switch (action.kind) {
    case "product.create": {
      const { data, error } = await client.rpc("create_product", {
        p_shop_id: shop.id, p_name: action.name, p_sku: action.sku || null, p_unit: action.unit,
        p_selling_price: action.sellingPrice, p_cost_price: action.costPrice ?? null,
        p_threshold: action.threshold, p_opening_stock: action.openingStock,
      });
      if (error) return databaseError(error);
      return Response.json({ ok: true, id: data });
    }
    case "product.edit": {
      const { data, error } = await client.from("products").update({
        name: action.name, sku: action.sku || null, unit: action.unit,
        selling_price: action.sellingPrice, cost_price: action.costPrice,
        low_stock_threshold: action.threshold,
      }).eq("id", action.id).eq("shop_id", shop.id).is("archived_at", null).select("id").maybeSingle();
      if (error) return databaseError(error);
      if (!data) return Response.json({ error: "Product not found." }, { status: 404 });
      return Response.json({ ok: true, id: data.id });
    }
    case "product.adjust": {
      const { data, error } = await client.rpc("adjust_stock", {
        p_shop_id: shop.id, p_product_id: action.id, p_delta: action.delta, p_note: action.note || null,
      });
      if (error) return databaseError(error);
      return Response.json({ ok: true, currentStock: data });
    }
    case "product.archive": {
      const { data, error } = await client.from("products")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", action.id).eq("shop_id", shop.id).eq("current_stock", 0)
        .is("archived_at", null).select("id").maybeSingle();
      if (error) return databaseError(error);
      if (!data) return Response.json({ error: "Reduce stock to zero before archiving this product." }, { status: 409 });
      return Response.json({ ok: true, id: data.id });
    }
    case "customer.create": {
      const { data, error } = await client.from("customers")
        .insert({ shop_id: shop.id, name: action.name, phone: action.phone || null })
        .select("id").single();
      if (error) return databaseError(error);
      return Response.json({ ok: true, id: data.id });
    }
    case "khata.add": {
      const { data: customer, error: customerError } = await client.from("customers")
        .select("id").eq("id", action.customerId).eq("shop_id", shop.id).maybeSingle();
      if (customerError) return databaseError(customerError);
      if (!customer) return Response.json({ error: "Customer not found." }, { status: 404 });
      const { data, error } = await client.from("khata_entries").insert({
        shop_id: shop.id, customer_id: action.customerId, type: action.type,
        amount: action.amount, note: action.note || null,
      }).select("id").single();
      if (error) return databaseError(error);
      return Response.json({ ok: true, id: data.id });
    }
    case "sale.record": {
      if (new Set(action.items.map((item) => item.productId)).size !== action.items.length) {
        return Response.json({ error: "Select each product only once." }, { status: 422 });
      }
      const { data: saleId, error } = await client.rpc("record_sale", {
        p_shop_id: shop.id, p_items: action.items, p_payment_method: action.paymentMethod,
      });
      if (error) return databaseError(error);
      const { data: sale, error: readError } = await client.from("sales")
        .select("id,total_amount,payment_method,created_at").eq("id", saleId).eq("shop_id", shop.id).single();
      if (readError) return Response.json({ error: "Sale saved, but confirmation could not be loaded. Check recent sales before retrying." }, { status: 500 });
      return Response.json({ ok: true, sale: saleSchema.parse(sale) });
    }
  }
}

function databaseError(error: { code?: string; message: string }) {
  if (error.code === "23505") return Response.json({ error: "This name or SKU already exists." }, { status: 409 });
  if (error.code === "23514" || error.code === "22023" || error.code === "22P02") {
    return Response.json({ error: "Check the entered values and try again." }, { status: 422 });
  }
  if (error.code === "P0001") return Response.json({ error: "Insufficient stock or product unavailable." }, { status: 409 });
  if (error.code === "P0002") return Response.json({ error: "Product not found." }, { status: 404 });
  if (error.code === "42501") return Response.json({ error: "You do not have access to this shop." }, { status: 403 });
  return Response.json({ error: "The store action could not be completed. Please try again." }, { status: 503 });
}
