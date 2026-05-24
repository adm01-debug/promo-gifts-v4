import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import {
  parseContract,
} from "../_shared/contracts/index.ts";
import {
  ProductWebhookSchemas,
  type ProductWebhookV1Payload,
  type ProductWebhookV2Payload,
} from "../_shared/contracts/schemas/product-webhook.ts";
import type { Database } from "../../src/integrations/supabase/types.ts";

const corsHeaders = buildPublicCorsHeaders({ extraAllowHeaders: ["x-webhook-secret", "accept-version"] });

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("N8N_PRODUCT_WEBHOOK_SECRET");

type ProductPayload =
  | NonNullable<ProductWebhookV1Payload["product"]>
  | NonNullable<ProductWebhookV2Payload["product"]>;

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

  try {
    // Webhook secret check (mantido idêntico)
    const providedSecret = req.headers.get("x-webhook-secret");
    if (webhookSecret && providedSecret !== webhookSecret) {
      console.error("Invalid webhook secret");
      return new Response(
        JSON.stringify({ code: "unauthorized", message: "Unauthorized", fields: [] }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse + valida + versiona em um único passo
    const result = await parseContract(req, ProductWebhookSchemas, { corsHeaders });
    if (!result.ok) return result.response;

    const { version, data, responseHeaders } = result;
    // headers anexados em TODAS as respostas de sucesso (versão + deprecation)
    const okHeaders = { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" };

    console.log(`[product-webhook] version=${version} action=${data.action}`);

    // Normalização v1/v2 → forma interna comum
    const products = data.products as ProductPayload[] | undefined;
    const singleProduct = data.product as ProductPayload | undefined;
    const externalIds = data.external_ids as string[] | undefined;

    const { data: syncLog, error: logError } = await supabase
      .from("product_sync_logs")
      .insert({
        status: "processing",
        source: version === "2" ? "n8n_v2" : "n8n",
        products_received: products?.length || (singleProduct ? 1 : 0),
      })
      .select()
      .single();

    if (logError) {
      console.error("Error creating sync log:", logError);
    }

    const syncLogId = syncLog?.id;

    let outcome: { created: number; updated: number; failed: number; errors: string[] } = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    switch (data.action) {
      case "upsert": {
        if (!singleProduct) {
          throw new Error("Product data is required for upsert action");
        }
        outcome = await upsertProducts(supabase, [singleProduct]);
        break;
      }

      case "batch_upsert":
      case "sync": {
        if (!products || products.length === 0) {
          throw new Error("Products array is required for batch_upsert/sync action");
        }
        outcome = await upsertProducts(supabase, products);
        break;
      }

      case "delete": {
        if (!externalIds || externalIds.length === 0) {
          throw new Error("external_ids array is required for delete action");
        }
        const { error: deleteError, count } = await supabase
          .from("products")
          .delete()
          .in("external_id", externalIds);
        if (deleteError) throw deleteError;
        outcome = { created: 0, updated: 0, failed: 0, errors: [] };
        console.log(`Deleted ${count} products`);
        break;
      }

      default:
        throw new Error(`Unknown action: ${(data as { action: string }).action}`);
    }

    if (syncLogId) {
      await supabase
        .from("product_sync_logs")
        .update({
          status: outcome.failed > 0 ? "partial" : "completed",
          products_created: outcome.created,
          products_updated: outcome.updated,
          products_failed: outcome.failed,
          error_message: outcome.errors.length > 0 ? outcome.errors.join("; ") : null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLogId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: outcome.created,
        updated: outcome.updated,
        failed: outcome.failed,
        errors: outcome.errors,
        sync_log_id: syncLogId,
      }),
      { headers: okHeaders },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Product webhook error:", error);
    return new Response(
      JSON.stringify({ code: "internal_error", message: errorMessage, fields: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function upsertProducts(
  supabase: SupabaseClient<Database>,
  products: ProductPayload[],
): Promise<{ created: number; updated: number; failed: number; errors: string[] }> {
  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const product of products) {
    try {
      const stockStatus = calculateStockStatus(product.stock || 0);

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
        const { error: updateError } = await supabase
          .from("products")
          .update(productData)
          .eq("id", existingProduct.id);
        if (updateError) throw updateError;
        updated++;
        console.log(`Updated product: ${product.sku}`);
      } else {
        const { error: insertError } = await supabase.from("products").insert(productData);
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
