import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, requireRole, authErrorResponse } from "../_shared/auth.ts";
/// <reference lib="deno.ns" />
// BUG-010 FIX: Aligned SDK version from @2.49.1 to @2.49.4 (standard for all edge functions).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
// BUG-010 FIX: Changed from "https://esm.sh/zod@3.23.8" to npm: direct — removes import_map
// dependency for deployment. The import_map in deno.json still covers local dev/deno check;
// production deploy (supabase functions deploy) no longer requires --import-map flag for zod.
import { z } from "npm:zod@3.23.8";
import { parseBodyWithSchema } from "../_shared/zod-validate.ts";
import { resolveCredential } from "../_shared/credentials.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// BUG-010 FIX: REMOVED module-level `const n8nWebhookUrl = Deno.env.get("N8N_QUOTE_WEBHOOK_URL")`.
// Module-scope reads are frozen at cold-start; key rotations via /admin/conexoes had no effect.
// URL is now resolved inside sendToN8N() using resolveCredential() (DB-first SSOT).

/**
 * Resolve credenciais do CRM externo (DB-first via integration_credentials,
 * env fallback via aliases CRM_SUPABASE_URL → EXTERNAL_CRM_URL).
 */
async function getCrmCreds(): Promise<{ url: string | null; key: string | null }> {
  const [urlRes, svcRes, anonRes] = await Promise.all([
    resolveCredential("EXTERNAL_CRM_URL"),
    resolveCredential("EXTERNAL_CRM_SERVICE_ROLE_KEY"),
    resolveCredential("EXTERNAL_CRM_ANON_KEY"),
  ]);
  return { url: urlRes.value, key: svcRes.value ?? anonRes.value };
}

// ===== Zod Schemas =====

const SyncQuoteSchema = z.object({
  action: z.literal('sync_quote'),
  data: z.object({
    quoteId: z.string().uuid('quoteId must be a valid UUID'),
  }),
});

const SyncAllPendingSchema = z.object({
  action: z.literal('sync_all_pending'),
  data: z.object({}).optional(),
});

const TestWebhookSchema = z.object({
  action: z.literal('test_webhook'),
  data: z.object({}).optional(),
});

const RequestSchema = z.discriminatedUnion('action', [
  SyncQuoteSchema,
  SyncAllPendingSchema,
  TestWebhookSchema,
]);

// ===== Types =====

interface QuoteData {
  id: string;
  quote_number: string;
  client_id?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  client_company?: string;
  seller_id?: string;
  seller_name?: string;
  status: string;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  total: number;
  notes?: string;
  valid_until?: string;
  payment_terms?: string;
  delivery_time?: string;
  shipping_type?: string;
  shipping_cost?: number;
  items: QuoteItemData[];
  created_at: string;
  internal_real_subtotal?: number;
  internal_real_discount_percent?: number;
  internal_negotiation_markup_percent?: number;
}

interface QuoteItemData {
  product_id: string;
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  color_name?: string;
  personalizations: PersonalizationData[];
}

interface PersonalizationData {
  technique_name: string;
  colors_count: number;
  positions_count: number;
  total_cost: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);
  try {
    const authCtx = await authenticateRequest(req);
    requireRole(authCtx, "agente");
  } catch (authErr) {
    return authErrorResponse(authErr, corsHeaders);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const parsed = await parseBodyWithSchema(req, RequestSchema, getCorsHeaders(req));
    if ('error' in parsed) return parsed.error;

    const { action, data } = parsed.data;
    console.log("Quote sync request received:", { action, hasData: Boolean(data) });

    // BUG-010 FIX: resolve n8nWebhookUrl once per request inside handler (not at module scope).
    const { value: n8nWebhookUrl } = await resolveCredential("N8N_QUOTE_WEBHOOK_URL");

    switch (action) {
      case "sync_quote": {
        const { quoteId } = data;
        const quoteData = await fetchQuoteFromCRM(quoteId);
        if (!quoteData) throw new Error("Quote not found in CRM");

        let n8nResponse: Record<string, unknown> = {};
        if (n8nWebhookUrl) {
          try { n8nResponse = await sendToN8N(quoteData, n8nWebhookUrl); }
          catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const errType = err instanceof Error ? err.constructor.name : typeof err;
            console.error("N8N sync failed (non-blocking):", {
              error: errMsg,
              type: errType,
              quoteId,
              timestamp: new Date().toISOString(),
            });
          }
        }

        await sendToSalesPro(quoteData);
        await updateCRMSyncStatus(quoteId, n8nResponse);

        return new Response(
          JSON.stringify({ success: true, message: "Quote synced successfully", bitrix_deal_id: n8nResponse.bitrix_deal_id, bitrix_quote_id: n8nResponse.bitrix_quote_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "sync_all_pending": {
        const { url: crmUrl, key: crmKey } = await getCrmCreds();
        if (!crmUrl || !crmKey) throw new Error("CRM database not configured");
        const crm = createClient(crmUrl, crmKey);

        const { data: pendingQuotes, error: fetchError } = await crm
          .from("quotes").select("id").eq("synced_to_bitrix", false).in("status", ["sent", "approved"]);
        if (fetchError) throw fetchError;

        const results = [];
        for (const quote of pendingQuotes || []) {
          try {
            const quoteData = await fetchQuoteFromCRM(quote.id);
            if (quoteData) {
              let response: Record<string, unknown> = {};
              if (n8nWebhookUrl) {
                try { response = await sendToN8N(quoteData, n8nWebhookUrl); } catch { /* skip */ }
              }
              await sendToSalesPro(quoteData);
              await updateCRMSyncStatus(quote.id, response);
              results.push({ id: quote.id, success: true });
            }
          } catch (syncErr) {
            const errorMessage = syncErr instanceof Error ? syncErr.message : "Unknown error";
            results.push({ id: quote.id, success: false, error: errorMessage });
          }
        }

        return new Response(
          JSON.stringify({ success: true, synced: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "test_webhook": {
        const results: Record<string, unknown> = {};

        if (n8nWebhookUrl) {
          try {
            const response = await fetch(n8nWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
            });
            results.n8n = { success: response.ok, status: response.status };
          } catch (e) {
            results.n8n = { success: false, error: String(e) };
          }
        }

        // BUG-010 FIX: use resolveCredential for SALESPRO credentials
        const { value: salesProUrl } = await resolveCredential("SALESPRO_WEBHOOK_URL");
        const { value: salesProApiKey } = await resolveCredential("QUOTE_SYNC_API_KEY");
        if (salesProUrl && salesProApiKey) {
          try {
            const response = await fetch(salesProUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": salesProApiKey },
              body: JSON.stringify({ test: true, timestamp: new Date().toISOString(), source: "gifts-store" }),
            });
            const body = await response.text();
            results.salespro = { success: response.ok, status: response.status, body };
          } catch (e) {
            results.salespro = { success: false, error: String(e) };
          }
        }

        return new Response(
          JSON.stringify({ success: true, results }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Quote sync error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ===== Fetch quote data from external CRM database =====
async function fetchQuoteFromCRM(quoteId: string): Promise<QuoteData | null> {
  const { url: crmUrl, key: crmKey } = await getCrmCreds();
  if (!crmUrl || !crmKey) throw new Error("CRM database credentials not configured");

  const crm = createClient(crmUrl, crmKey);

  const { data: quote, error: quoteError } = await crm.from("quotes").select("*").eq("id", quoteId).single();
  if (quoteError || !quote) { console.error("Error fetching quote:", quoteError); return null; }

  const { data: items, error: itemsError } = await crm
    .from("quote_items").select("*, quote_item_personalizations(*)").eq("quote_id", quoteId).order("sort_order");
  if (itemsError) console.error("Error fetching items:", itemsError);

  let sellerName: string | undefined;
  if (quote.seller_id) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", quote.seller_id).single();
    sellerName = profile?.full_name;
  }

  const formattedItems: QuoteItemData[] = (items || []).map((item: Record<string, unknown>) => ({
    product_id: item.product_id as string,
    product_name: item.product_name as string,
    product_sku: item.product_sku as string | undefined,
    quantity: item.quantity as number,
    unit_price: Number(item.unit_price),
    subtotal: Number(item.subtotal),
    color_name: item.color_name as string | undefined,
    personalizations: ((item.quote_item_personalizations as Record<string, unknown>[]) || []).map((p) => ({
      technique_name: (p.technique_name as string) || "Unknown",
      colors_count: p.colors_count as number,
      positions_count: p.positions_count as number,
      total_cost: Number(p.total_cost),
    })),
  }));

  return {
    id: quote.id, quote_number: quote.quote_number,
    client_id: quote.client_id, client_name: quote.client_name,
    client_email: quote.client_email, client_phone: quote.client_phone,
    client_company: quote.client_company, seller_id: quote.seller_id,
    seller_name: sellerName, status: quote.status,
    subtotal: Number(quote.subtotal || 0), discount_percent: Number(quote.discount_percent || 0),
    discount_amount: Number(quote.discount_amount || 0), total: Number(quote.total || 0),
    notes: quote.notes, valid_until: quote.valid_until,
    payment_terms: quote.payment_terms, delivery_time: quote.delivery_time,
    shipping_type: quote.shipping_type, shipping_cost: Number(quote.shipping_cost || 0),
    items: formattedItems, created_at: quote.created_at,
    internal_real_subtotal: quote.real_subtotal != null ? Number(quote.real_subtotal) : undefined,
    internal_real_discount_percent: quote.real_discount_percent != null ? Number(quote.real_discount_percent) : undefined,
    internal_negotiation_markup_percent: quote.negotiation_markup_percent != null ? Number(quote.negotiation_markup_percent) : undefined,
  };
}

async function updateCRMSyncStatus(quoteId: string, n8nResponse: Record<string, unknown>): Promise<void> {
  const { url: crmUrl, key: crmKey } = await getCrmCreds();
  if (!crmUrl || !crmKey) return;
  const crm = createClient(crmUrl, crmKey);
  const { error } = await crm.from("quotes").update({
    synced_to_bitrix: true, synced_at: new Date().toISOString(),
    bitrix_deal_id: (n8nResponse?.bitrix_deal_id as string) || null,
    bitrix_quote_id: (n8nResponse?.bitrix_quote_id as string) || null,
  }).eq("id", quoteId);
  if (error) console.error("Error updating CRM sync status:", error);
}

// BUG-010 FIX: sendToN8N now receives webhookUrl as parameter (no more module-scope closure).
async function sendToN8N(quoteData: QuoteData, webhookUrl: string): Promise<Record<string, unknown>> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create_or_update_quote", quote: quoteData, timestamp: new Date().toISOString() }),
  });
  if (!response.ok) {
    await response.text();
    throw new Error(`N8N webhook failed: ${response.status}`);
  }
  try { return await response.json(); } catch { return { success: true }; }
}

// BUG-010 FIX: sendToSalesPro uses resolveCredential (DB-first SSOT) instead of Deno.env.get.
async function sendToSalesPro(quoteData: QuoteData): Promise<void> {
  const { value: webhookUrl } = await resolveCredential("SALESPRO_WEBHOOK_URL");
  const { value: apiKey } = await resolveCredential("QUOTE_SYNC_API_KEY");
  if (!webhookUrl || !apiKey) { console.warn("SalesPro not configured, skipping"); return; }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ action: "create_or_update_quote", quote: quoteData, source: "gifts-store", timestamp: new Date().toISOString() }),
    });
    if (!response.ok) {
      await response.text();
      console.error("SalesPro webhook error:", { status: response.status });
    } else {
      console.log("SalesPro sync successful");
    }
  } catch (err) {
    console.error("SalesPro sync failed:", err);
  }
}
