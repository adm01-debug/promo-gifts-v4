import { getCorsHeaders } from '../_shared/cors.ts';
import { z } from '../_shared/zod-validate.ts';
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from '../_shared/external-fetch.ts';
import { authorize } from '../_shared/authorize.ts';
// BUG-006 FIX: import resolveCredential for SSOT credential resolution (DB-first -> env fallback).
// Previously used Deno.env.get("N8N_QUOTE_WEBHOOK_URL") directly, bypassing credential SSOT.
import { resolveCredential } from '../_shared/credentials.ts';

const SELLER_EMAIL_MAP: Record<string, number> = {
  "comercial01@promobrindes.com.br": 8,
  "henrique.silva@promobrindes.com.br": 10,
  "comercial03@promobrindes.com.br": 16,
  "comercial04@promobrindes.com.br": 5174,
  "comercial06@promobrindes.com.br": 5176,
  "comercial05@promobrindes.com.br": 5180,
  "comercial07@promobrindes.com.br": 16558,
};

const SyncQuoteBitrixSchema = z.object({
  quote: z.record(z.any()).optional(),
  proposalData: z.record(z.any()).optional(),
  pdfUrl: z.string().url().max(2000).optional(),
  filename: z.string().max(500).optional(),
  bitrixCompanyId: z.string().max(50).optional(),
  shippingType: z.string().max(50).optional(),
  shippingCost: z.number().nonnegative().optional(),
  sellerEmail: z.string().email().max(255).optional(),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = await authorize(req);
    if (!auth.ok) return auth.response;

    const authenticatedEmail = auth.user.email ?? null;

    let rawBody: unknown;
    try { rawBody = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = SyncQuoteBitrixSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { quote, proposalData, pdfUrl, filename, bitrixCompanyId, shippingType, shippingCost } = parsed.data;

    // BUG-006 FIX: use resolveCredential (DB-first SSOT) instead of Deno.env.get().
    const { value: webhookUrl } = await resolveCredential("N8N_QUOTE_WEBHOOK_URL");
    if (!webhookUrl) {
      throw new Error("N8N_QUOTE_WEBHOOK_URL nao configurado nos secrets");
    }

    const sellerEmail = authenticatedEmail;
    const sellerId = sellerEmail ? SELLER_EMAIL_MAP[sellerEmail] : undefined;
    if (sellerEmail && sellerId === undefined) {
      console.warn(`sellerEmail autenticado "${sellerEmail}" nao mapeado no SELLER_EMAIL_MAP`);
    }

    const companyId = bitrixCompanyId ? parseInt(bitrixCompanyId, 10) : null;
    if (!companyId || !Number.isFinite(companyId) || companyId <= 0) {
      throw new Error("company_id (Bitrix) e obrigatorio.");
    }

    const rawItems = proposalData?.items || [];
    const itemsValidos = rawItems.filter((item: any) => !!item.bitrix_product_id);
    const itemsExcluidos = rawItems.length - itemsValidos.length;
    if (itemsExcluidos > 0) console.warn(`${itemsExcluidos} item(ns) excluido(s) por nao ter bitrix_product_id`);
    if (itemsValidos.length === 0) throw new Error("Nenhum produto possui bitrix_product_id. Aguarde importacao do catalogo.");

    const products = itemsValidos.map((item: any) => ({
      offer_id: item.bitrix_product_id,
      product_name: item.product_name || item.name,
      quantity: item.quantity || 1,
      unit_price: item.unit_price || item.price || 0,
      color: item.color || null,
    }));

    const n8nPayload = {
      quote_id: quote?.id || null,
      quote_number: quote?.quote_number || null,
      company_id: companyId,
      seller_id: sellerId || null,
      seller_email: sellerEmail,
      products,
      pdf_url: pdfUrl || null,
      filename: filename || null,
      shipping_type: shippingType || null,
      shipping_cost: shippingCost ?? null,
      total: proposalData?.total || quote?.total_amount || 0,
      sent_at: new Date().toISOString(),
    };

    const response = await fetchWithBreaker("bitrix", webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nPayload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("n8n webhook error:", response.status, errText);
      throw new Error(`n8n webhook error: ${response.status}`);
    }

    const result = await response.json();
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    if (err instanceof CircuitOpenError) return circuitOpenResponse(err, corsHeaders);
    console.error("sync-quote-bitrix error:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
