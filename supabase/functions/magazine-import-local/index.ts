// supabase/functions/magazine-import-local/index.ts
//
// One-shot: migra as revistas que o vendedor já criou em localStorage
// (magazineService v1) para o BD Gold. Chamado automaticamente pelo
// front (1x) na primeira vez que o usuário abre /magazine após o deploy
// desta migração — sem isso, os vendedores perderiam o trabalho já feito.
//
// verify_jwt = true (usuário autenticado; grava como o próprio dono)
//
// Mapeamento de IDs: os IDs legados (`mag_<uuid>`, `item_<uuid>`) e tokens
// (`crypto.randomUUID()` com hífens) NÃO são reaproveitados — o BD gera
// novos UUIDs e tokens hex conforme o schema. O front deve atualizar seus
// registros locais com os novos IDs retornados.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.23.8";
import { getCorsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";

const itemSchema = z.object({
  productId: z.string(),
  productSnapshot: z.record(z.unknown()),
  variantColorName: z.string().nullable().optional(),
  position: z.number(),
  pageNumber: z.number().nullable().optional(),
  overrides: z.record(z.unknown()).optional(),
});

const magazineSchema = z.object({
  localId: z.string(), // ID legado, só para o front conseguir mapear old→new na resposta
  title: z.string().max(200).default("Nova Revista"),
  subtitle: z.string().max(300).default(""),
  templateId: z.string().default("editorial-vogue"),
  branding: z.record(z.unknown()).optional(),
  content: z.record(z.unknown()).optional(),
  items: z.array(itemSchema).max(500).default([]), // FIX A12: limite de itens por revista
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

const bodySchema = z.object({
  magazines: z.array(magazineSchema).max(200), // FIX A12: limite de revistas por import
});

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "magazine-import-local", requestId, req });
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    if (req.method !== "POST") {
      return log.respond(new Response(JSON.stringify({ error: "method_not_allowed", request_id: requestId }), { status: 405, headers: jsonHeaders }));
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return log.respond(new Response(JSON.stringify({ error: "unauthorized", request_id: requestId }), { status: 401, headers: jsonHeaders }));
    }

    // Client autenticado como o usuário (RLS aplica normalmente — dono só grava para si)
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return log.respond(new Response(JSON.stringify({ error: "unauthorized", request_id: requestId }), { status: 401, headers: jsonHeaders }));
    }
    const ownerId = userData.user.id;

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return log.respond(new Response(
        JSON.stringify({ error: "invalid_request", request_id: requestId, details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: jsonHeaders },
      ));
    }

    const results: Array<{ localId: string; newId: string | null; publicToken: string | null; error?: string }> = [];

    // Usa o client do usuário (não service_role) — RLS garante owner_id correto,
    // e reaproveita magazines_owner_all + magazine_items_via_owner_or_org.
    for (const mag of parsed.data.magazines) {
      const { data: inserted, error: insErr } = await userClient
        .from("magazines")
        .insert({
          owner_id: ownerId,
          title: mag.title,
          subtitle: mag.subtitle,
          template_id: mag.templateId,
          ...(mag.branding ? { branding: mag.branding } : {}),
          ...(mag.content ? { content_settings: mag.content } : {}),
          status: mag.status === "published" ? "draft" : mag.status, // republica manualmente depois (token novo)
        })
        .select("id, public_token")
        .single();

      if (insErr || !inserted) {
        log.error("magazine_insert_failed", { localId: mag.localId, error: insErr?.message });
        results.push({ localId: mag.localId, newId: null, publicToken: null, error: insErr?.message ?? "insert_failed" });
        continue;
      }

      if (mag.items.length > 0) {
        const { error: itemsErr } = await userClient.from("magazine_items").insert(
          mag.items.map((it) => ({
            magazine_id: inserted.id,
            product_id: it.productId,
            product_snapshot: it.productSnapshot,
            variant_color_name: it.variantColorName ?? null,
            position: it.position,
            page_number: it.pageNumber ?? null,
            overrides: it.overrides ?? {},
          })),
        );
        if (itemsErr) {
          log.warn("items_insert_partial_failure", { localId: mag.localId, error: itemsErr.message });
        }
      }

      results.push({ localId: mag.localId, newId: inserted.id, publicToken: inserted.public_token });
    }

    log.info("import_complete", { total: results.length, ok: results.filter((r) => r.newId).length });
    return log.respond(new Response(JSON.stringify({ results, request_id: requestId }), { status: 200, headers: jsonHeaders }));
  } catch (err) {
    log.error("unhandled_exception", { err });
    return log.respond(new Response(JSON.stringify({ error: "internal_error", request_id: requestId }), { status: 500, headers: jsonHeaders }));
  }
});
