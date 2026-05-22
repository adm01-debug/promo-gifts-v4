import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { buildErrorResponse, buildValidationErrorResponse } from "../_shared/validation-errors.ts";

const BodySchema = z.object({
  token: z.string().min(1, "Token não fornecido"),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return buildErrorResponse("invalid_json", "Invalid JSON body", req, corsHeaders, { status: 400 });
    }

    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error, req, corsHeaders);
    }

    const { token } = parsed.data;

    // Verify the token from email link
    const { data: { user }, error: verifyError } = await supabase.auth.admin.getUserById(token);

    if (verifyError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user metadata to mark email as verified
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true
    });

    if (updateError) {
      console.error('Error confirming email:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao confirmar email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Email verified for user: ${user.email}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Email verificado com sucesso' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in verify-email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});