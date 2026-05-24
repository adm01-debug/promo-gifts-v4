import { getCorsHeaders } from '../_shared/cors.ts';
import { z } from '../_shared/zod-validate.ts';
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from '../_shared/external-fetch.ts';
import { authorize } from '../_shared/authorize.ts';

// Mapping: seller email → Bitrix24 numeric seller_id
const SELLER_EMAIL_MAP: Record<string, number> = {
  "comercial01@promobrindes.com.br": 8,
  "henrique.silva@promobrindes.com.br": 10,
  "comercial03@promobrindes.com.br": 16,
  "comercial04@promobrindes.com.br": 5174,
  "comercial06@promobrindes.com.br": 5176,
  "comercial05@promobrindes.com.br": 5180,
  "comercial07@promobrindes.com.br": 16558,
};

// Onda 10 (B-2): sellerEmail removido do schema. Agora vem do JWT autenticado
// (auth.user.email) para impedir que um atacante com anon key forje requests
// atribuindo deals a outros vendedores no Bitrix.
const SyncQuoteBitrixSchema = z.object({
  quote: z.record(z.any()).optional(),
  proposalData: z.record(z.any()).optional(),
  pdfUrl: z.string().url().max(2000).optional(),
  filename: z.string().max(500).optional(),
  bitrixCompanyId: z.string().max(50).optional(),
  shippingType: z.string().max(50).optional(),
  shippingCost: z.number().nonnegative().optional(),
  // sellerEmail REMOVIDO — vem do JWT autenticado (Onda 10 B-2).
  // Aceitamos no body por compat retroativa de clients antigos mas IGNORAMOS o valor.
  sellerEmail: z.string().email().max(255).optional(),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Onda 10 (B-2): hardening de auth ──────────────────────────────────
    // Antes: verify_jwt default aceitava qualquer JWT — incluindo o anon key
    // do bundle frontend. Resultado: qualquer pessoa com DevTools podia chamar
    // este endpoint e poluir o CRM Bitrix com deals falsos atribuidos a vendedor
    // real (sellerEmail vinha do body).
    //
    // Agora: authorize() valida que o token e um JWT REAL de USUARIO (nao anon),
    // e o sellerEmail e derivado do auth.user.email — atacante nao pode forjar.
    //
    // requireRole NAO foi passado porque o banco tem roles legadas coexistindo
    // (vendedor/admin) que o helper authorize.ts so reconhece nas novas (agente/
    // supervisor/dev). Bloquear apenas anon (sem requireRole) ja resolve B-2.
    // Quando dual admin pattern for resolvido (memoria do PO), reativar requireRole.
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

    const {
      quote,
      proposalData,
      pdfUrl,
      filename,
      bitrixCompanyId,
      shippingType,
      shippingCost,
      // sellerEmail do body NAO e desestruturado — usamos authenticatedEmail
    } = parsed.data;

    // ── 1. Validate webhook URL ──────────────────────────────────────────────
    const webhookUrl = Deno.env.get("N8N_QUOTE_WEBHOOK_URL");
    if (!webhookUrl) {
      throw new Error("N8N_QUOTE_WEBHOOK_URL não configurado nos secrets");
    }

    // ── 2. Resolve seller_id (Onda 10: usa email AUTENTICADO, nao do body) ──
    const sellerEmail = authenticatedEmail;
    const sellerId = sellerEmail ? SELLER_EMAIL_MAP[sellerEmail] : undefined;
    if (sellerEmail && sellerId === undefined) {
      console.warn(`sellerEmail autenticado "${sellerEmail}" nao mapeado no SELLER_EMAIL_MAP — orcamento enviado sem seller_id`);
    }

    // ── 3. Resolve company_id (Bitrix numeric) — OBRIGATÓRIO (Spec v3.2) ────
    // bitrixCompanyId comes from companies.bitrix_id (string like "125240")
    const companyId = bitrixCompanyId ? parseInt(bitrixCompanyId, 10) : null;
    if (!companyId || !Number.isFinite(companyId) || companyId <= 0) {
      throw new Error("company_id (Bitrix) é obrigatório. Verifique se a empresa possui vínculo com o Bitrix24.");
    }

    // ── 4. REMOVIDO: bitrix_quote_id não é mais enviado no payload ───────────
    // Spec v3: o n8n busca pelo quote_id (código interno) no Bitrix e resolve sozinho
    // se deve criar ou atualizar. O gifts-store não precisa manter o ID do Bitrix.

    // ── 5. Build products array ──────────────────────────────────────────────
    // offer_id is null if not mapped — n8n handles this gracefully
    const rawItems = proposalData?.items || [];

    // ── Spec §3: excluir itens sem bitrix_product_id (ainda não importados no Bitrix24) ──
    const itemsValidos = rawItems.filter((item: any) => !!item.bitrix_product_id);
    const itemsExcluidos = rawItems.length - itemsValidos.length;
    if (itemsExcluidos > 0) {
      console.warn(`${itemsExcluidos} item(ns) excluído(s) do payload por não ter bitrix_product_id`);
    }
    if (itemsValidos.length === 0) {
      throw new Error("Nenhum produto da proposta possui ID no Bitrix24 (bitrix_product_id nulo em todos os itens). Aguarde a importação do catálogo.");
    }

    const products = itemsValidos.map((item: any) => {
      // Spec §6.2: offer_id = product_variants.bitrix_product_id (obrigatório)
      const offerId = Number(item.bitrix_product_id);
      if (!Number.isFinite(offerId) || offerId <= 0) {
        console.warn(`Item ignorado: bitrix_product_id inválido ("${item.bitrix_product_id}") — produto: ${item.name || item.product_name}`);
        return null;
      }

      // product_name = nome do produto + " - " + cor
      const baseName = item.name || item.product_name || "Produto";
      const colorSuffix = item.color ? ` - ${item.color}` : "";
      const productName = `${baseName}${colorSuffix}`;

      // SKU = supplier_sku da variante
      const sku = item.supplier_sku || item.composedCode || item.sku || item.product_sku || "";

      const qty = Number(item.quantity ?? 1);
      if (!Number.isFinite(qty) || qty <= 0) {
        console.warn(`Item ignorado: quantity inválida (${item.quantity}) — produto: ${baseName}`);
        return null;
      }

      // Spec v3.4: price = preço unitário SÓ DO PRODUTO (sem gravação, sem desconto)
      const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);

      const product: any = {
        offer_id: offerId,
        product_name: productName,
        sku,
        price: Math.round(unitPrice * 10000) / 10000,
        quantity: qty,
      };

      // Gravação (engraving) — valores do banco, sem recalcular
      // DB fields: unit_cost (preço unitário c/ markup), total_cost (MAX(valor_gravacao, setup)),
      //            setup_cost (custo de setup c/ markup)
      const allPers = item.personalizations || [];
      if (allPers.length > 0) {
        // Support multiple personalizations: aggregate all into one engraving block
        const engravings = allPers.map((pers: any) => {
          // total_cost from DB is the source of truth (includes markup + min billing)
          // unit_price = total_cost / qty rounded to 2 decimals — matches UI display
          const engravingTotal = Number(pers.total_cost ?? 0);
          const engravingUnit = qty > 0 ? Math.round((engravingTotal / qty) * 100) / 100 : 0;
          const setupPrice = Number(pers.setup_cost ?? 0);

          // size: try structured fields first, then parse from notes "Local — CODE | WxHcm"
          let sizeStr = "";
          if (pers.width_cm != null && pers.height_cm != null) {
            sizeStr = `${pers.width_cm}x${pers.height_cm}cm`;
          } else if (pers.area_cm2 != null) {
            sizeStr = `${pers.area_cm2}cm²`;
          } else if (pers.notes) {
            const dimMatch = String(pers.notes).match(/\|\s*([\d.,]+)\s*[x×]\s*([\d.,]+)\s*cm/i);
            if (dimMatch) {
              sizeStr = `${dimMatch[1]}x${dimMatch[2]}cm`;
            }
          }

          // engraving.type = "Technique | Location"
          let engravingType = pers.technique_name || "Personalização";
          if (pers.notes) {
            const notesRaw = String(pers.notes);
            const [locationPart] = notesRaw.split(" | ");
            if (locationPart) {
              const locationName = locationPart.split(" — ")[0]?.trim();
              if (locationName) {
                engravingType = `${engravingType} | ${locationName}`;
              }
            }
          }

          // Recalculate total from rounded unit to ensure subtotal parity with proposal
          const engravingTotalRounded = engravingUnit * qty;

          return {
            type: engravingType,
            unit_price: engravingUnit,
            total_price: Math.round(engravingTotalRounded * 100) / 100,
            setup_price: setupPrice,
            size: sizeStr,
          };
        });

        // Primary engraving (first one) — backward compatible
        product.engraving = engravings[0];

        // If multiple, attach full array
        if (engravings.length > 1) {
          product.engravings = engravings;
        }
      }

      return product;
    }).filter((p: any) => p !== null);

    if (products.length === 0) {
      throw new Error("Todos os itens foram rejeitados por dados inválidos (offer_id ou quantity). Verifique os dados dos produtos.");
    }

    // ── 6. Assemble final payload ────────────────────────────────────────────
    const rawClientName =
      proposalData?.client?.company ||
      proposalData?.client?.name ||
      quote?.client_company ||
      "Cliente";

    // Fix #4: Remove trailing " - XXXX" (bitrix_id suffix) to avoid duplication in title
    const clientName = rawClientName.replace(/\s*-\s*\d+\s*$/, "").trim();

    const payload: Record<string, unknown> = {
      title: `Orçamento - ${clientName} - ${companyId}`,
      company_id: companyId,
      products,
    };

    // Only include optional fields when resolved
    if (sellerId) payload.seller_id = sellerId;

    // Spec v3: quote_id = código interno do gifts-store (ex: "10001/26")
    const internalQuoteId = (quote?.quote_number || "").replace(/\s+/g, "");
    if (internalQuoteId) payload.quote_id = internalQuoteId;

    // Spec v3.4: discount_percentage — desconto global em % (ex: 5, 10, 15)
    const rawDiscount = Number(quote?.discount_percent ?? 0);
    if (Number.isFinite(rawDiscount) && rawDiscount > 0) {
      payload.discount_percentage = rawDiscount;
    }

    // Spec v3.4: freight — from direct shippingType/shippingCost fields (decoded by frontend)
    // Fallback: parse from internal_notes marker |||FRETE:tipo:custo|||
    let resolvedFreightType: string | null = null;
    let resolvedFreightValue: number | null = null;

    if (shippingType) {
      // Direct fields from frontend (preferred)
      const typeMap: Record<string, string> = { cif: "CIF", fob: "FOB", fob_pre: "FOB_PRE" };
      resolvedFreightType = typeMap[shippingType.toLowerCase()] || null;
      resolvedFreightValue = Number(shippingCost) || null;
    } else {
      // Fallback: parse from internal_notes marker
      const freightMatch = String(quote?.internal_notes || "").match(/\|\|\|FRETE:([^:]+):([^|]*)\|\|\|/);
      if (freightMatch) {
        const freightTypeMap: Record<string, string> = { CIF: "CIF", FOB: "FOB", FOB_PRE: "FOB_PRE" };
        resolvedFreightType = freightTypeMap[freightMatch[1].toUpperCase()] || null;
        resolvedFreightValue = parseFloat(freightMatch[2]) || null;
      }
    }

    if (resolvedFreightType) {
      const freight: Record<string, unknown> = { type: resolvedFreightType };
      if (resolvedFreightValue && Number.isFinite(resolvedFreightValue) && resolvedFreightValue > 0) {
        // If type is FOB but has a value, upgrade to FOB_PRE
        if (resolvedFreightType === "FOB") {
          freight.type = "FOB_PRE";
        }
        freight.value = resolvedFreightValue;
      }
      payload.freight = freight;
    }

    // Contact (numeric Bitrix contact_id if available)
    if (quote?.bitrix_contact_id) {
      const cId = parseInt(String(quote.bitrix_contact_id), 10);
      if (!isNaN(cId)) payload.contact_id = cId;
    }

    // Attach PDF URL
    if (pdfUrl && filename) {
      payload.pdf = { filename, url: pdfUrl };
    }

    // ── 7. Log (no sensitive content) ───────────────────────────────────────
    console.log("Sending quote sync payload to n8n:", {
      products_count: products.length,
      has_pdf: Boolean(payload.pdf),
      has_bitrix_company_id: Boolean(bitrixCompanyId),
    });

    // ── 8. Call n8n webhook ──────────────────────────────────────────────────
    const response = await fetchWithBreaker("bitrix", webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let result: unknown;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      // n8n sometimes returns plain text on error
      const text = await response.text();
      result = { raw: text };
    }

    console.log("n8n response received:", {
      status: response.status,
      content_type: contentType || 'unknown',
    });

    if (!response.ok) {
      const errMsg = (result as any)?.error || `HTTP ${response.status}`;
      throw new Error(errMsg);
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    if (error instanceof CircuitOpenError) {
      return circuitOpenResponse(error, corsHeaders);
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("sync-quote-bitrix error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
