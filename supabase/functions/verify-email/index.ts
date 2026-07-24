// supabase/functions/verify-email/index.ts
// BUG-EF-001 FIXED: Substituído getUserById(token) por verifyOtp — API correta.
// BUG-EF-011 FIXED: Import Zod padronizado para npm:zod@3.23.8.
import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  // token_hash: gerado pelo Supabase no link de verificação de email
  // type: tipo de verificação ('email' | 'recovery' | 'invite' | 'magiclink')
  token_hash: z.string().min(1, "token_hash não fornecido"),
  type: z.enum(['email', 'recovery', 'invite', 'magiclink']).default('email'),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  const preflightResponse = handleCorsPreflightIfNeeded(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('[verify-email] Missing required env vars');
      return new Response(
        JSON.stringify({ error: 'Serviço temporariamente indisponível' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'JSON inválido no corpo da requisição' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message || 'Dados inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { token_hash, type } = parsed.data;

    // BUG-EF-001 FIX: verifyOtp é a API correta para verificar tokens de email.
    // Antes: supabase.auth.admin.getUserById(token) ← ERRADO (token ≠ UUID)
    // Agora: supabase.auth.verifyOtp({ token_hash, type }) ← CORRETO
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (verifyError || !data.user) {
      console.error('[verify-email] OTP verification failed:', {
        code: verifyError?.code ?? 'no_user',
        message: verifyError?.message ?? 'Nenhum usuário retornado',
      });
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[verify-email] Email verification completed for user:', data.user.id);

    return new Response(
      JSON.stringify({ success: true, message: 'Email verificado com sucesso' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    console.error('[verify-email] Unexpected error:', message);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao verificar email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
