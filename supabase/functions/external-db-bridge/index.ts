// supabase/functions/external-db-bridge/index.ts
// DECOMMISSIONED — returns 410 Gone for all requests.
//
// Phase 4B (2026-06-01): bridge permanently killed via kill-switch
// `edge_external_db_bridge`. All traffic routes to REST native (/rest/v1/).
// Previous index.ts had ~400 lines importing 6 missing _shared modules
// (external-db-config, external-db-aliases, external-db-telemetry,
//  external-db-cache, json-response, old cors API). Replaced with this stub.
//
// 2026-06-18: adicionada propagação de X-Request-Id + structured logger
// (gate check-edge-request-id-propagation / rota CRITICAL).

import { getCorsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";

Deno.serve(async (req) => {
  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "external-db-bridge", requestId, req });
  log.warn("request_decommissioned");

  const corsHeaders = getCorsHeaders(req);

  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  return log.respond(
    new Response(
      JSON.stringify({
        error: "endpoint_decommissioned",
        message: "external-db-bridge foi descomissionada. Use REST nativo (/rest/v1/).",
      }),
      {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    ),
  );
});
