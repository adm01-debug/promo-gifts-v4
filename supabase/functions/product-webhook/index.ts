import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { parseRequestWithContract } from "../_shared/zod-validate.ts";
import {
  contracts as productWebhookContracts,
  type WebhookPayloadV1Type,
  type WebhookPayloadV2Type,
} from "../_shared/contracts/product-webhook.contracts.ts";

const corsHeaders = buildPublicCorsHeaders({
  extraAllowHeaders: ["x-webhook-secret", "x-contract-version"],
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("N8N_PRODUCT_WEBHOOK_SECRET");

type ProductV1 = NonNullable<WebhookPayloadV1Type["product"]>;
type ProductV2 = NonNullable<WebhookPayloadV2Type["product"]>;

/**
 * Achata payload v2 ({price: {amount,currency}}) para o shape v1 (price number)
 * que o resto do handler já entende. Currency vai para metadata.
 */
function normalizeV2Product(p: ProductV2): ProductV1 {
  const { price, ...rest } = p;
  return {
    ...rest,
    price: price.amount,
    metadata: { ...(p.metadata ?? {}), currency: price.currency },
  };
}

interface WebhookPayload {
  action: "sync" | "upsert" | "delete" | "batch_upsert";
  products?: ProductV1[];
  product?: ProductV1;
  external_ids?: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Validate webhook secret
    const providedSecret = req.headers.get("x-webhook-secret");
    if (webhookSecret && providedSecret !== webhookSecret) {
      console.error("Invalid webhook secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parseResult = await parseRequestWithContract(
      req,
      productWebhookContracts,
      corsHeaders,
    );
    if ("error" in parseResult) return parseResult.error;

    const { data, version, responseHeaders: contractHeaders } = parseResult;

    let payload: WebhookPayload;
    if (version === "v2") {
      const v2 = data as WebhookPayloadV2Type;
      payload = {
        action: v2.action,
        product: v2.product ? normalizeV2Product(v2.product) : undefined,
        products: v2.products ? v2.products.map(normalizeV2Product) : undefined,
        external_ids: v2.external_ids,
      };
    } else {
      payload = data as WebhookPayloadV1Type;
    }
    console.log(`Product webhook action: ${payload.action} (contract ${version})`);

    // Create sync log
    const { data: syncLog, error: logError } = await supabase
      .from("product_sync_logs")
      .insert({
        status: "processing",
        source: "n8n",
        products_received: payload.products?.length || (payload.product ? 1 : 0),
      })
      .select()
      .single();

    if (logError) {
      console.error("Error creating sync log:", logError);
    }

    const syncLogId = syncLog?.id;

    let result: {
      created: number;
      updated: number;
      failed: number;
      errors: string[];
    } = { created: 0, updated: 0, failed: 0, errors: [] };

    switch (payload.action) {
      case "upsert": {
        // Single product upsert
        if (!payload.product) {
          throw new Error("Product data is required for upsert action");
        }
        result = await upsertProducts(supabase, [payload.product]);
        break;
      }

      case "batch_upsert":
      case "sync": {
        // Batch upsert multiple products
        if (!payload.products || payload.products.length === 0) {
          throw new Error("Products array is required for batch_upsert/sync action");
        }
        result = await upsertProducts(supabase, payload.products);
        break;
      }

      case "delete": {
        // Delete products by external_id
        if (!payload.external_ids || payload.external_ids.length === 0) {
          throw new Error("external_ids array is required for delete action");
        }

        const { error: deleteError, count } = await supabase
          .from("products")
          .delete()
          .in("external_id", payload.external_ids);

        if (deleteError) {
          throw deleteError;
        }

        result = { created: 0, updated: 0, failed: 0, errors: [] };
        console.log(`Deleted ${count} products`);
        break;
      }

      default:
        throw new Error(`Unknown action: ${payload.action}`);
    }

    // Update sync log
    if (syncLogId) {
      await supabase
        .from("product_sync_logs")
        .update({
          status: result.failed > 0 ? "partial" : "completed",
          products_created: result.created,
          products_updated: result.updated,
          products_failed: result.failed,
          error_message: result.errors.length > 0 ? result.errors.join("; ") : null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLogId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        errors: result.errors,
        sync_log_id: syncLogId,
      }),
      {
        headers: {
          ...corsHeaders,
          ...contractHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Product webhook error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function upsertProducts(
  supabase: any,
  products: ProductV1[]
): Promise<{ created: number; updated: number; failed: number; errors: string[] }> {
  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const product of products) {
    try {
      // Determine stock status
      const stockStatus = calculateStockStatus(product.stock || 0);

      // Prepare product data
      const productData = {
        external_id: product.external_id || null,
        sku: product.sku,
        name: product.name,
        description: product.description || null,
        price: product.price || 0,
        min_quantity: product.min_quantity || 1,
        category_id: product.category_id || null,
        category_name: product.category_name || null,
        subcategory: product.subcategory || null,
        supplier_id: product.supplier_id || null,
        supplier_name: product.supplier_name || null,
        stock: product.stock || 0,
        stock_status: product.stock_status || stockStatus,
        is_kit: product.is_kit || false,
        is_active: product.is_active !== false,
        featured: product.featured || false,
        new_arrival: product.new_arrival || false,
        on_sale: product.on_sale || false,
        images: product.images || [],
        video_url: product.video_url || null,
        colors: product.colors || [],
        materials: product.materials || [],
        tags: product.tags || {},
        kit_items: product.kit_items || [],
        variations: product.variations || [],
        metadata: product.metadata || {},
        synced_at: new Date().toISOString(),
      };

      // Check if product exists by external_id or sku
      let existingProduct = null;
      
      if (product.external_id) {
        const { data } = await supabase
          .from("products")
          .select("id")
          .eq("external_id", product.external_id)
          .maybeSingle();
        existingProduct = data;
      }
      
      if (!existingProduct) {
        const { data } = await supabase
          .from("products")
          .select("id")
          .eq("sku", product.sku)
          .maybeSingle();
        existingProduct = data;
      }

      if (existingProduct) {
        // Update existing product
        const { error: updateError } = await supabase
          .from("products")
          .update(productData)
          .eq("id", existingProduct.id);

        if (updateError) throw updateError;
        updated++;
        console.log(`Updated product: ${product.sku}`);
      } else {
        // Insert new product
        const { error: insertError } = await supabase
          .from("products")
          .insert(productData);

        if (insertError) throw insertError;
        created++;
        console.log(`Created product: ${product.sku}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`${product.sku}: ${errMsg}`);
      failed++;
      console.error(`Failed to upsert product ${product.sku}:`, err);
    }
  }

  return { created, updated, failed, errors };
}

function calculateStockStatus(stock: number): string {
  if (stock <= 0) return "out-of-stock";
  if (stock < 100) return "low-stock";
  return "in-stock";
}
