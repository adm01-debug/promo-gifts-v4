// supabase/functions/send-notification/index.ts
// BUG-EF-003 FIXED: Removido o primeiro handler OPTIONS duplicado (sem CORS headers)
//   que tornava o segundo handler (correto) inacessivel.
// BUG-NOTIF-003 FIXED: DND check agora passa user_id explicitamente à RPC
//   is_dnd_active, evitando dependência de auth.uid() que é NULL quando a função
//   é chamada com service_role_key (sem JWT de usuário autenticado).
import { getCorsHeaders } from '../_shared/cors.ts';
// BULK-SDK-FIX: Changed from esm.sh URL to npm: direct — removes import_map dependency.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.23.8";
import { castRpcResult } from "../_shared/supabase-client-adapter.ts";
import { authorizeCron } from "../_shared/dispatcher-auth.ts";

const NotificationSchema = z.object({
  user_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  message: z.string().min(1).max(5000),
  type: z.string().max(50).optional().default('info'),
  category: z.string().max(50).optional().default('system'),
  action_url: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

function jsonRes(corsHeaders: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // BUG-EF-003 FIX: Apenas UM handler OPTIONS, com getCorsHeaders(req) correto.
  // Antes havia dois: o primeiro retornava 204 sem headers CORS (bloqueando preflight),
  // o segundo nunca era alcancado.
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Cron: exige x-cron-secret para evitar chamadas diretas nao autorizadas
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

    const rawBody = await req.json();
    const parsed = NotificationSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonRes(corsHeaders, { error: 'Invalid payload', details: parsed.error.flatten().fieldErrors }, 400);
    }

    const payload = parsed.data;

    // BUG-NOTIF-003 FIX: Passa p_user_id explicitamente à RPC is_dnd_active.
    // Sem isso, a RPC dependia de auth.uid() que é NULL ao usar service_role_key,
    // fazendo o DND nunca funcionar corretamente (always returning null/false).
    const { data: isDND } = await castRpcResult<{
      data: boolean | null;
      error: { message: string } | null;
    }>(supabase.rpc('is_dnd_active', { p_user_id: payload.user_id }));

    // If DND is active and not urgent, skip
    if (isDND && payload.type !== 'urgent') {
      return jsonRes(corsHeaders, {
        success: true,
        skipped: true,
        reason: 'DND active',
      });
    }

    // Insert into workspace_notifications
    const { data: notification, error } = await supabase
      .from('workspace_notifications')
      .insert({
        user_id: payload.user_id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        category: payload.category,
        action_url: payload.action_url || null,
        metadata: payload.metadata || null,
        is_read: false,
      })
      .select()
      .single();

    if (error) throw error;

    return jsonRes(corsHeaders, {
      success: true,
      notification_id: notification.id,
    });

  } catch (error) {
    console.error('[send-notification] error:', error instanceof Error ? error.message : 'unknown');
    return jsonRes(corsHeaders, { error: 'internal_error' }, 500);
  }
});
