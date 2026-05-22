import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseContract } from "../_shared/contracts/index.ts";
import {
  SyncExternalDbSchemas,
} from "../_shared/contracts/schemas/sync-external-db.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const contractResult = await parseContract(req, SyncExternalDbSchemas, {
      corsHeaders,
    });
    if (!contractResult.ok) return contractResult.response;
    const { data: body, responseHeaders } = contractResult;
    const { table } = body;
    const direction = body.direction ?? "to-external";
    const since = body.since;

    // 1. Conexão com Supabase Interno (Lovable)
    const internalUrl = Deno.env.get("SUPABASE_URL")!;
    const internalKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalSupabase = createClient(internalUrl, internalKey);

    // 2. Conexão com Supabase Externo
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("VITE_EXTERNAL_SUPABASE_URL");
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY");

    if (!externalUrl || !externalKey) {
       return new Response(JSON.stringify({ error: "External Supabase credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
      });
    }

    const externalSupabase = createClient(externalUrl, externalKey);

    let sourceClient = direction === "to-external" ? internalSupabase : externalSupabase;
    let targetClient = direction === "to-external" ? externalSupabase : internalSupabase;

    console.log(`Starting sync for table ${table} in direction ${direction}${since ? ` since ${since}` : ''}`);

    // 3. Buscar dados da origem
    let query = sourceClient.from(table).select("*").limit(1000);
    
    // Sincronização incremental se updated_at estiver disponível e solicitado
    if (since) {
      query = query.gt('updated_at', since);
    }

    const { data: sourceData, error: sourceError } = await query;

    if (sourceError) throw sourceError;

    if (!sourceData || sourceData.length === 0) {
      return new Response(JSON.stringify({ message: "No data to sync", count: 0 }), {
        headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Inserir/Atualizar no destino (Upsert)
    const { data: syncResult, error: syncError } = await targetClient
      .from(table)
      .upsert(sourceData, { onConflict: 'id' });

    if (syncError) throw syncError;

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Synced ${sourceData.length} records to ${direction === "to-external" ? 'external' : 'internal'} database.`,
      count: sourceData.length,
      last_updated: sourceData.length > 0 ? sourceData.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), sourceData[0].updated_at) : null
    }), {
      headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
