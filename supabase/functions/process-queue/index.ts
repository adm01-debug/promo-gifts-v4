import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { authorizeCron } from "../_shared/dispatcher-auth.ts";
import { safeErrorResponse } from "../_shared/error-response.ts";

const corsHeaders = buildPublicCorsHeaders();

Deno.serve(async (req) => {
  // Cron: exige x-cron-secret para evitar chamadas diretas não autorizadas
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  const cronAuth = await authorizeCron(req, { corsHeaders: {}, secretEnvName: "CRON_SECRET", headerName: "x-cron-secret" });
  if (!cronAuth.ok) return cronAuth.response;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Atomic fetch + cleanup in a single RPC call (process_notifications_queue
    // returns unread rows and deletes expired ones in the same transaction).
    const { data: unreadNotifs, error: fetchError } = await supabase.rpc(
      'process_notifications_queue',
      { p_limit: 500 }
    );

    if (fetchError) throw fetchError;

    if (!unreadNotifs || unreadNotifs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message: 'No unread notifications to process'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group by user
    type NotifRow = { user_id: string; id: string; title: string; message: string; type: string; category: string; created_at: string };
    const byUser = new Map<string, NotifRow[]>();
    for (const notif of (unreadNotifs as NotifRow[])) {
      const existing = byUser.get(notif.user_id) || [];
      existing.push(notif);
      byUser.set(notif.user_id, existing);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: byUser.size,
        users_with_unread: byUser.size,
        total_unread: unreadNotifs.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return safeErrorResponse(error, {
      corsHeaders,
      publicMessage: 'queue_processing_failed',
      logLabel: 'Queue processing error:',
    });
  }
});
