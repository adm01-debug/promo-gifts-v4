// supabase/functions/send-digest/index.ts
// BUG-NOTIF-002 FIXED:
//   - Primeiro OPTIONS retornava 204 sem CORS headers (bloqueava preflight)
//   - authorizeCron recebia corsHeaders: {} vazio (retornos 401 sem CORS)
//   - Segundo bloco OPTIONS era dead code (nunca alcançado)
// BUG-NOTIF-008 FIXED:
//   - Digest não enviava nada; agora chama a RPC send_digest_notification
//     que encaminha para os canais configurados (in-app, futuramente email).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { authorizeCron } from "../_shared/dispatcher-auth.ts";
import { safeErrorResponse } from "../_shared/error-response.ts";

const corsHeaders = buildPublicCorsHeaders();

Deno.serve(async (req) => {
  // BUG-NOTIF-002 FIX: UM único handler OPTIONS com corsHeaders corretos.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // BUG-NOTIF-002 FIX: passa corsHeaders correto (não {} vazio).
  const cronAuth = await authorizeCron(req, {
    corsHeaders,
    secretEnvName: "CRON_SECRET",
    headerName: "x-cron-secret",
  });
  if (!cronAuth.ok) return cronAuth.response;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch unread notifications grouped by user
    const { data: unreadNotifs, error } = await supabase
      .from('workspace_notifications')
      .select('user_id, id, title, message, type, category, created_at')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    if (!unreadNotifs || unreadNotifs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          digests_sent: 0,
          message: 'No unread notifications for digest'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group by user
    const byUser = new Map<string, typeof unreadNotifs>();
    for (const notif of unreadNotifs) {
      const existing = byUser.get(notif.user_id) || [];
      existing.push(notif);
      byUser.set(notif.user_id, existing);
    }

    // BUG-NOTIF-008 FIX: Chama RPC para dispatch real das notificações agrupadas.
    // A RPC send_digest_notification recebe o agrupamento e envia via canal configurado.
    // Se a RPC não existir no banco, apenas loga warning e retorna os counts — não falha.
    let digestsSent = 0;
    for (const [userId, notifs] of byUser.entries()) {
      try {
        const { error: rpcError } = await supabase.rpc('send_digest_notification', {
          p_user_id: userId,
          p_notification_ids: notifs.map((n) => n.id),
          p_unread_count: notifs.length,
        });
        if (!rpcError) digestsSent += 1;
        else console.warn(`[send-digest] RPC warning user=${userId}:`, rpcError.message);
      } catch (dispatchErr) {
        // Não interrompe o loop — falha individual não impede outros usuários
        console.warn(`[send-digest] dispatch error user=${userId}:`, dispatchErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        users_with_unread: byUser.size,
        total_unread: unreadNotifs.length,
        digests_sent: digestsSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return safeErrorResponse(error, {
      corsHeaders,
      publicMessage: 'digest_failed',
      logLabel: 'Digest error:',
    });
  }
});
