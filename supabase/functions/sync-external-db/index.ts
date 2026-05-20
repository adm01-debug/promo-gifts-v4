import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";
import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { authorize } from "../_shared/authorize.ts";

Deno.serve(async (req) => {
  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "sync-external-db", requestId, req });

  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  // Dev-only: sincronização cross-DB com service_role nos dois lados.
  const auth = await authorize(req, { requireRole: "dev" });
  if (!auth.ok) {
    log.warn("sync_denied", { reason: "insufficient_role" });
    return auth.response;
  }

  try {
    const { table, direction = "to-external", since } = await req.json();

    if (!table) {
      return log.respond(new Response(JSON.stringify({ error: "Table name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }));
    }

    // 1. Conexão com Supabase Interno (Lovable)
    const internalUrl = Deno.env.get("SUPABASE_URL")!;
    const internalKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalSupabase = createClient(internalUrl, internalKey);

    // 2. Conexão com Supabase Externo
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("VITE_EXTERNAL_SUPABASE_URL");
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY");

    if (!externalUrl || !externalKey) {
       return log.respond(new Response(JSON.stringify({ error: "External Supabase credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }));
    }

    const externalSupabase = createClient(externalUrl, externalKey);

    const sourceClient = direction === "to-external" ? internalSupabase : externalSupabase;
    const targetClient = direction === "to-external" ? externalSupabase : internalSupabase;

    log.info("sync_started", { table, direction, since: since ?? null });

    // 3. Buscar dados da origem
    let query = sourceClient.from(table).select("*").limit(1000);
    
    // Sincronização incremental se updated_at estiver disponível e solicitado
    if (since) {
      query = query.gt('updated_at', since);
    }

    const { data: sourceData, error: sourceError } = await query;

    if (sourceError) throw sourceError;

    if (!sourceData || sourceData.length === 0) {
      return log.respond(new Response(JSON.stringify({ message: "No data to sync", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }));
    }

    // 4. Inserir/Atualizar no destino (Upsert)
    const { data: syncResult, error: syncError } = await targetClient
      .from(table)
      .upsert(sourceData, { onConflict: 'id' });

    if (syncError) throw syncError;

    log.info("sync_completed", { table, direction, count: sourceData.length });
    return log.respond(new Response(JSON.stringify({
      success: true,
      message: `Synced ${sourceData.length} records to ${direction === "to-external" ? 'external' : 'internal'} database.`,
      count: sourceData.length,
      last_updated: sourceData.length > 0 ? sourceData.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), sourceData[0].updated_at) : null
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }));

  } catch (error) {
    // Detalhe do erro fica só no log estruturado (server-side); ao cliente
    // devolvemos mensagem genérica + request_id (evita vazar stack trace — CodeQL).
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("sync_failed", { error: errorMessage });
    return log.respond(new Response(JSON.stringify({ error: "Sync failed", request_id: requestId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }));
  }
});
