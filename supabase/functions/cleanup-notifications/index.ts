import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { buildPublicCorsHeaders } from '../_shared/cors.ts';
import { authorizeCron } from '../_shared/dispatcher-auth.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';

const corsHeaders = buildPublicCorsHeaders();

Deno.serve(async (req) => {
  // Cron: exige x-cron-secret para evitar chamadas diretas não autorizadas
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  const cronAuth = await authorizeCron(req, {
    corsHeaders: {},
    secretEnvName: 'CRON_SECRET',
    headerName: 'x-cron-secret',
  });
  if (!cronAuth.ok) return cronAuth.response;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const stats = {
      deleted_read_old: 0,
    };

    // Delete read notifications older than 90 days using the existing RPC
    const { error: cleanupError } = await supabase.rpc('cleanup_old_notifications');

    if (cleanupError) {
      console.warn('Cleanup RPC warning:', safeErrorFields(cleanupError));
    } else {
      stats.deleted_read_old = -1; // RPC doesn't return count
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Cleanup error:', safeErrorFields(error));
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
