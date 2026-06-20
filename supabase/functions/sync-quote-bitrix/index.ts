import { getCorsHeaders } from '../_shared/cors.ts';
import { z } from '../_shared/zod-validate.ts';
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from '../_shared/external-fetch.ts';
import { authorize } from '../_shared/authorize.ts';
import { resolveCredential } from '../_shared/credentials.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

// BUG-A09 FIX (26/05/2026): SELLER_EMAIL_MAP era hardcoded no código.
// Novo vendedor exigia PR + deploy. Vendedor demitido = ID órfão.
// Fix: busca email → bitrix_id direto da tabela `profiles` (coluna `bitrix_id`).
// Fallback: se o perfil não tiver bitrix_id preenchido, loga warning e segue sem seller_id.
async function resolveSellerBitrixId(
  email: string | null,
  // deno-lint-ignore no-explicit-any
  serviceClient: any,
): Promise<number | null> {
  if (!email) return null;
  try {
    const { data, error } = await serviceClient
      .from('profiles')
      .select('bitrix_id')
      .eq('email', email)
      .maybeSingle();
    if (error) {
      console.warn('[sync-quote-bitrix] erro ao buscar bitrix_id do perfil:', error.message);
      return null;
    }
    if (!data?.bitrix_id) {
      console.warn(`[sync-quote-bitrix] perfil '${email}' sem bitrix_id configurado. Preencha profiles.bitrix_id.`);
      return null;
    }
    return data.bitrix_id as number;
  } catch (err) {
    console.warn('[sync-quote-bitrix] falha ao resolver seller_id:', err);
    return null;
  }
}

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ONDA-16 (30/05/2026): gate de role reativado. O bloqueador do NaN
    // (ROLE_RANK['vendedor'] undefined) foi corrigido em _shared/authorize.ts,
    // entao agora exigimos tier-base interna (vendedor/admin/dev) em vez de
    // apenas "qualquer autenticado". Defesa-em-profundidade prevista na Onda 10.
    const auth = await authorize(req, { requireRole: 'vendedor' });
    if (!auth.ok) return auth.response;

    const authenticatedEmail = auth.user.email ?? null;

    let rawBody: unknown;
    try { rawBody = await req.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = SyncQuoteBitrixSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { quote, proposalData, pdfUrl, filename, bitrixCompanyId, shippingType, shippingCost } = parsed.data;

    const { value: webhookUrl } = await resolveCredential('N8N_QUOTE_WEBHOOK_URL');
    if (!webhookUrl) {
      throw new Error('N8N_QUOTE_WEBHOOK_URL nao configurado nos secrets');
    }

    // BUG-A09 FIX: busca bitrix_id do banco em vez do mapa hardcoded
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const sellerId = await resolveSellerBitrixId(authenticatedEmail, serviceClient);

    const companyId = bitrixCompanyId ? parseInt(bitrixCompanyId, 10) : null;
    if (!companyId || !Number.isFinite(companyId) || companyId <= 0) {
      throw new Error('company_id (Bitrix) e obrigatorio.');
    }

    const rawItems = proposalData?.items || [];
    const itemsValidos = rawItems.filter((item: any) => !!item.bitrix_product_id);
    const itemsExcluidos = rawItems.length - itemsValidos.length;
    if (itemsExcluidos > 0) console.warn(`${itemsExcluidos} item(ns) excluido(s) por nao ter bitrix_product_id`);
    if (itemsValidos.length === 0) throw new Error('Nenhum produto possui bitrix_product_id. Aguarde importacao do catalogo.');

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
      seller_id: sellerId,
      seller_email: authenticatedEmail,
      products,
      pdf_url: pdfUrl || null,
      filename: filename || null,
      shipping_type: shippingType || null,
      shipping_cost: shippingCost ?? null,
      total: proposalData?.total || quote?.total || 0,
      sent_at: new Date().toISOString(),
    };

    const response = await fetchWithBreaker('bitrix', webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('n8n webhook error:', response.status, errText);
      throw new Error(`n8n webhook error: ${response.status}`);
    }

    const result = await response.json();
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    if (err instanceof CircuitOpenError) return circuitOpenResponse(err, corsHeaders);
    console.error('sync-quote-bitrix error:', err);
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
