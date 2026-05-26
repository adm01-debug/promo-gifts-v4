import { getCorsHeaders } from '../_shared/cors.ts';
import { safeErrorResponse } from '../_shared/error-response.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { parseBodyWithSchema } from "../_shared/zod-validate.ts";
// BUG-012 FIX: import resolveCredential for SSOT credential resolution (DB-first -> env fallback).
// Previously used Deno.env.get('EXTERNAL_SUPABASE_URL') and Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY')
// directly, bypassing the credential management system (/admin/conexoes).
// This meant key rotations via admin UI had NO effect until the Deno isolate was restarted.
import { resolveCredential } from '../_shared/credentials.ts';

const ActionSchema = z.object({
  action: z.enum(['get_active_dates', 'get_upcoming_dates', 'get_products_by_date', 'get_dates_with_colors']),
  params: z.object({
    days_ahead: z.number().int().min(1).max(365).optional(),
    slug: z.string().trim().min(1).max(200).optional(),
    limit: z.number().int().min(1).max(500).optional(),
    include_all_colors: z.boolean().optional(),
  }).optional(),
});

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
        JSON.stringify({ error: 'N\u00e3o autorizado' }),
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
        JSON.stringify({ error: 'Token inv\u00e1lido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate body with Zod
    const parsed = await parseBodyWithSchema(req, ActionSchema, corsHeaders);
    if ('error' in parsed) return parsed.error;

    const { action, params } = parsed.data;

    // BUG-012 FIX: use resolveCredential() (DB-first SSOT) instead of Deno.env.get().
    // EXTERNAL_PROMOBRIND_URL resolves aliases: EXTERNAL_SUPABASE_URL (legacy env name).
    // EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY resolves: EXTERNAL_SUPABASE_SERVICE_ROLE_KEY,
    // EXTERNAL_SUPABASE_SERVICE_KEY (legacy aliases).
    const [{ value: externalUrl }, { value: externalKey }] = await Promise.all([
      resolveCredential('EXTERNAL_PROMOBRIND_URL'),
      resolveCredential('EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY'),
    ]);

    if (!externalUrl || !externalKey) {
      console.warn('[commemorative-dates] External DB credentials not configured — returning empty payload');
      return new Response(
        JSON.stringify({ data: [], records: [], count: 0, _unconfigured: true, _message: 'Banco externo n\u00e3o configurado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const externalSupabase = createClient(externalUrl, externalKey);
    let result;

    switch (action) {
      case 'get_active_dates': {
        const { data, error } = await externalSupabase.rpc('get_active_commemorative_dates');
        if (error) {
          return safeErrorResponse(error, { corsHeaders, publicMessage: 'query_failed', status: 400, logLabel: 'commemorative-dates query error:' });
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
          return safeErrorResponse(error, { corsHeaders, publicMessage: 'query_failed', status: 400, logLabel: 'commemorative-dates query error:' });
        }
        result = data;
        break;
      }

      case 'get_products_by_date': {
        const slug = params?.slug;
        if (!slug) {
          return new Response(JSON.stringify({ error: 'Slug \u00e9 obrigat\u00f3rio' }),
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
          return safeErrorResponse(error, { corsHeaders, publicMessage: 'query_failed', status: 400, logLabel: 'commemorative-dates query error:' });
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
          return safeErrorResponse(error, { corsHeaders, publicMessage: 'query_failed', status: 400, logLabel: 'commemorative-dates query error:' });
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
    return safeErrorResponse(error, { corsHeaders, publicMessage: 'internal_error', logLabel: 'commemorative-dates unexpected error:' });
  }
});
