// supabase/functions/external-db-bridge/index.ts
// DECOMMISSIONED — returns 410 Gone for all requests.
//
// Phase 4B (2026-06-01): bridge permanently killed via kill-switch
// `edge_external_db_bridge`. All traffic routes to REST native (/rest/v1/).
// Previous index.ts had ~400 lines importing 6 missing _shared modules
// (external-db-config, external-db-aliases, external-db-telemetry,
//  external-db-cache, json-response, old cors API). Replaced with this stub.

import { getCorsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  return new Response(
    JSON.stringify({
      error: "endpoint_decommissioned",
      message: "external-db-bridge foi descomissionada. Use REST nativo (/rest/v1/).",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
