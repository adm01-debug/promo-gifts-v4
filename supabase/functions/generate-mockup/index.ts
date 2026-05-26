import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse } from "../_shared/auth.ts";
// BUG-004 FIX: SDK import aligned to npm:@supabase/supabase-js@2.49.4 (standard for all edge
// functions). Replaces the previous GENERATE_PLACEHOLDER stub that had no SDK declaration.
// No functional impact — full implementation is pending a dedicated PR.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { assertSwitchEnabled } from "../_shared/kill_switch.ts";

/**
 * generate-mockup edge function.
 *
 * BUG-004: SDK version aligned to @2.49.4 for consistency across all edge functions.
 * This stub is intentionally minimal — it validates auth, checks the kill-switch,
 * and returns 501 until the full mockup-generation logic is implemented.
 */
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Kill-switch guard — allows disabling via feature flag without a redeploy.
  const killResponse = await assertSwitchEnabled("edge_generate_mockup", req, corsHeaders);
  if (killResponse) return killResponse;

  // Auth guard — consistent with all other protected edge functions.
  try {
    await authenticateRequest(req);
  } catch (authErr) {
    return authErrorResponse(authErr, corsHeaders);
  }

  // Supabase client declared here — available for the full implementation.
  const _supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // TODO: implement mockup generation logic in a dedicated PR.
  return new Response(
    JSON.stringify({
      error: "not_implemented",
      message: "generate-mockup is under construction — full implementation pending dedicated PR",
    }),
    {
      status: 501,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
