// supabase/functions/cleanup-notifications/index.ts
// BUG-NOTIF-001 FIXED:
//   - Primeiro OPTIONS retornava 204 sem CORS headers (bloqueava preflight)
//   - authorizeCron recebia corsHeaders: {} vazio (retornos 401 sem CORS)
//   - Segundo bloco OPTIONS era dead code (nunca alcançado)
// BUG-NOTIF-007 FIXED:
//   - stats.deleted_read_old = -1 como sentinel incorreto → agora null
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { buildPublicCorsHeaders } from '../_shared/cors.ts';
import { authorizeCron } from '../_shared/dispatcher-auth.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';

const corsHeaders = buildPublicCorsHeaders();

Deno.serve(async (req) => {
  // BUG-NOTIF-001 FIX: UM único handler OPTIONS com corsHeaders corretos.
  // Antes: 1º retornava 204 sem CORS (bloqueava preflight), 2º nunca era alcançado.
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Cron: exige x-cron-secret para evitar chamadas diretas não autorizadas
  // BUG-NOTIF-001 FIX: passa corsHeaders correto (não {} vazio) para que respostas
  // 401 do authorizeCron também carreguem os headers CORS necessários.
  const cronAuth = await authorizeCron(req, {
    corsHeaders,
    secretEnvName: 'CRON_SECRET',
    headerName: 'x-cron-secret',
  });
  if (!cronAuth.ok) return cronAuth.response;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const stats: { deleted_read_old: number | null } = {
      // BUG-NOTIF-007 FIX: null em vez de -1 como sentinel para "RPC não retorna count".
      // -1 era ambíguo e podia ser confundido com contagem real ou código de erro.
      deleted_read_old: null,
    };

    // Delete read notifications older than 90 days using the existing RPC
    const { error: cleanupError } = await supabase.rpc('cleanup_old_notifications');

    if (cleanupError) {
      console.warn('Cleanup RPC warning:', safeErrorFields(cleanupError));
    }
    // stats.deleted_read_old permanece null — RPC não retorna count, e isso é esperado.

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
