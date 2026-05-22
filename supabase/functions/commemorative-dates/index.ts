import { getCorsHeaders } from '../_shared/cors.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { parseBodyWithSchema } from "../_shared/zod-validate.ts";
import { contracts as commemorativeContracts } from "../_shared/contracts/commemorative-dates.contracts.ts";

const ActionSchema = commemorativeContracts.v1.schema;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const localSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await localSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate body with Zod
    const parsed = await parseBodyWithSchema(req, ActionSchema, corsHeaders);
    if ('error' in parsed) return parsed.error;

    const { action, params } = parsed.data;

    // External DB client
    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY');

    if (!externalUrl || !externalKey) {
      console.warn('[commemorative-dates] EXTERNAL_SUPABASE_URL/KEY not configured — returning empty payload');
      return new Response(
        JSON.stringify({ data: [], records: [], count: 0, _unconfigured: true, _message: 'Banco externo não configurado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const externalSupabase = createClient(externalUrl, externalKey);
    let result;

    switch (action) {
      case 'get_active_dates': {
        const { data, error } = await externalSupabase.rpc('get_active_commemorative_dates');
        if (error) {
          return new Response(JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = data;
        break;
      }

      case 'get_upcoming_dates': {
        const daysAhead = params?.days_ahead || 60;
        const { data, error } = await externalSupabase.rpc('get_upcoming_commemorative_dates', {
          p_days_ahead: daysAhead
        });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = data;
        break;
      }

      case 'get_products_by_date': {
        const slug = params?.slug;
        if (!slug) {
          return new Response(JSON.stringify({ error: 'Slug é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const limit = params?.limit || 100;
        const includeAllColors = params?.include_all_colors || false;

        const { data, error } = await externalSupabase.rpc('get_variants_for_commemorative_date', {
          p_slug: slug,
          p_limit: limit,
          p_include_all_colors: includeAllColors
        });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = data;
        break;
      }

      case 'get_dates_with_colors': {
        const { data, error } = await externalSupabase
          .from('v_commemorative_dates_with_colors')
          .select('*')
          .eq('is_active', true)
          .order('date_month')
          .order('date_day');
        if (error) {
          return new Response(JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = data;
        break;
      }
    }

    return new Response(
      JSON.stringify({ data: result, success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Unexpected error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
