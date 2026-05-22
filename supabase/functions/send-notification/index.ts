import { getCorsHeaders } from '../_shared/cors.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.23.8";
import { castRpcResult } from "../_shared/supabase-client-adapter.ts";
import { authorizeCron } from "../_shared/dispatcher-auth.ts";
import { buildValidationErrorResponse } from "../_shared/validation-errors.ts";

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
  // Cron: exige x-cron-secret para evitar chamadas diretas não autorizadas
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  const cronAuth = await authorizeCron(req, { corsHeaders: {}, secretEnvName: "CRON_SECRET", headerName: "x-cron-secret" });
  if (!cronAuth.ok) return cronAuth.response;

  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const rawBody = await req.json();
    const parsed = NotificationSchema.safeParse(rawBody);
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error, req, corsHeaders);
    }

    const payload = parsed.data;

    // Check DND status
    const { data: isDND } = await castRpcResult<{
      data: boolean | null;
      error: { message: string } | null;
    }>(supabase.rpc('is_dnd_active'));

    // If DND is active and not urgent, skip
    if (isDND && payload.type !== 'urgent') {
      return jsonRes(corsHeaders, { 
        success: true, 
        skipped: true,
        reason: 'DND active' 
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return jsonRes(corsHeaders, { error: errorMessage }, 500);
  }
});
