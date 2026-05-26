// supabase/functions/sync-external-db/index.ts
// BUG-EF-004 FIXED: supabase-js@2 (sem pin) -> @2.49.4
// BUG-EF-005 FIXED: Auth ausente em endpoint destrutivo -- adicionado authorizeCron
// BUG-EF-012 FIXED: console.log vaza nome de tabela -- substituido por log estruturado
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { parseContract } from "../_shared/contracts/index.ts";
import { SyncExternalDbSchemas } from "../_shared/contracts/schemas/sync-external-db.ts";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { authorizeCron } from "../_shared/dispatcher-auth.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";
import { getCredential } from "../_shared/credentials.ts";

const corsHeaders = buildPublicCorsHeaders();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "sync-external-db", requestId, req });

  // BUG-EF-005 FIX: Auth obrigatoria -- apenas cron/scheduler pode invocar.
  // Antes: sem nenhuma autenticacao. Qualquer um podia sincronizar qualquer tabela.
  const cronAuth = await authorizeCron(req, {
    corsHeaders,
    secretEnvName: "CRON_SECRET",
    headerName: "x-cron-secret",
  });
  if (!cronAuth.ok) return cronAuth.response;

  try {
    const contractResult = await parseContract(req, SyncExternalDbSchemas, { corsHeaders });
    if (!contractResult.ok) return contractResult.response;
    const { data: body, responseHeaders } = contractResult;
    const { table } = body;
    const direction = body.direction ?? "to-external";
    const since = body.since;

    // 1. Conexao com Supabase Interno
    const internalUrl = Deno.env.get("SUPABASE_URL");
    const internalKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!internalUrl || !internalKey) {
      log.error("missing_internal_config", {});
      return new Response(JSON.stringify({ error: "Internal Supabase credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
      });
    }

    const internalSupabase = createClient(internalUrl, internalKey);

    // 2. Conexao com Supabase Externo
    // fix: ssot-bypass — credential vault
    const externalUrl = await getCredential('EXTERNAL_PROMOBRIND_URL');
    const externalKey = await getCredential('EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY');

    if (!externalUrl || !externalKey) {
      log.error("missing_external_config", {});
      return new Response(JSON.stringify({ error: "External Supabase credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
      });
    }

    const externalSupabase = createClient(externalUrl, externalKey);

    const sourceClient = direction === "to-external" ? internalSupabase : externalSupabase;
    const targetClient = direction === "to-external" ? externalSupabase : internalSupabase;
    const targetLabel = direction === "to-external" ? "external" : "internal";

    // BUG-EF-012 FIX: log estruturado sem nome de tabela exposto
    log.info("sync_start", { direction, hasSince: !!since });

    // 3. Buscar dados da origem
    let query = sourceClient.from(table).select("*").limit(1000);
    if (since) {
      query = query.gt('updated_at', since);
    }

    const { data: sourceData, error: sourceError } = await query;

    if (sourceError) throw sourceError;

    if (!sourceData || sourceData.length === 0) {
      log.info("sync_no_data", { direction });
      return new Response(JSON.stringify({ message: "No data to sync", count: 0 }), {
        headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Inserir/Atualizar no destino (Upsert)
    const { error: syncError } = await targetClient
      .from(table)
      .upsert(sourceData, { onConflict: 'id' });

    if (syncError) throw syncError;

    const lastUpdated = sourceData.length > 0
      ? sourceData.reduce(
          (max: string, r: Record<string, unknown>) =>
            (r.updated_at as string) > max ? (r.updated_at as string) : max,
          sourceData[0].updated_at as string
        )
      : null;

    log.info("sync_complete", { count: sourceData.length, direction });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${sourceData.length} records to ${targetLabel} database.`,
        count: sourceData.length,
        last_updated: lastUpdated,
      }),
      { headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("sync_error", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
