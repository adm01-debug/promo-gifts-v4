import { getCorsHeaders } from '../_shared/cors.ts';
import { getCredential } from '../_shared/credentials.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { runBotProtection } from '../_shared/bot-protection.ts';

const BodySchema = z.object({
  mode: z.enum(['tables', 'columns']).default('tables'),
  tableName: z.string().trim().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/i, 'Invalid table name').optional(),
});

const corsHeadersRef: { current: Record<string, string> } = { current: {} };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersRef.current, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  corsHeadersRef.current = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeadersRef.current });
  }

  try {
    // Anti-scraping: bot UA check + rate limit por IP (camada externa antes do auth)
    const protection = await runBotProtection(req, {
      endpoint: 'external-db-inspect',
      maxRequests: 30,
      windowSeconds: 60,
      blockSeconds: 1800,
    }, corsHeadersRef.current);
    if (!protection.allowed) return protection.blockResponse!;

    // Auth guard: require authenticated admin user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Require admin role
    const { data: roleData } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return jsonResponse({ error: 'Forbidden: admin role required' }, 403);
    }

    // Validate body
    let rawBody: unknown = {};
    try { rawBody = await req.json(); } catch { /* empty body ok */ }

    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResponse({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, 400);
    }

    const { mode, tableName } = parsed.data;
    console.log(`[INSPECT] Mode: ${mode}, Table: ${tableName || 'all'}`);

    // External DB connection
    // fix: ssot-bypass — credential vault
    const externalUrl = await getCredential('EXTERNAL_PROMOBRIND_URL');
    const externalKey = await getCredential('EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY');
    if (!externalUrl || !externalKey) {
      console.warn('[external-db-inspect] EXTERNAL_SUPABASE_URL/KEY not configured — returning empty payload');
      return jsonResponse({ data: [], records: [], count: 0, _unconfigured: true, _message: 'Banco externo não configurado' }, 200);
    }

    const externalSupabase = createClient(externalUrl, externalKey);

    // Inspect specific table columns + row count (service-role bypassa RLS — só leitura)
    if (mode === 'columns' && tableName) {
      try {
        const { data, error, count } = await externalSupabase
          .from(tableName)
          .select('*', { count: 'exact', head: false })
          .limit(1);

        if (error) {
          return jsonResponse({ success: false, table: tableName, error: error.message });
        }

        const columns = data?.length ? Object.keys(data[0]) : [];
        return jsonResponse({
          success: true,
          table: tableName,
          rowCount: count ?? 0,
          sampleRow: data?.[0] ?? null,
          columns,
          columnTypes: columns.map(col => ({
            name: col,
            type: data?.[0] ? typeof data[0][col] : 'unknown',
          })),
        });
      } catch (err) {
        return jsonResponse({
          success: false,
          table: tableName,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    // Default: list all tables
    const tablesToTest = [
      'products', 'categories', 'suppliers', 'tags',
      'personalization_techniques', 'customization_price_tables',
      'product_images', 'product_videos', 'product_variants',
      'product_materials', 'product_tags', 'product_categories',
      'product_suppliers', 'product_print_areas', 'product_kit_components',
      'color_groups', 'color_nuances', 'color_equivalences', 'color_variations',
      'material_groups', 'material_types', 'material_variations',
      'supplier_colors', 'supplier_materials',
      'supplier_attribute_definitions', 'supplier_product_attributes',
      'product_attributes', 'category_attributes',
      'price_lists', 'variant_stocks', 'variant_cost_tiers', 'variant_sale_prices',
      'variation_types', 'variation_values', 'stock_movements',
      'collections', 'collection_products',
      'ramo_atividade', 'ramo_atividade_filho', 'produto_ramo_atividade',
      'bitrix_clients', 'organizations', 'client_contacts', 'business_sectors',
      'mockup_drafts', 'generated_mockups',
      // Arquitetura de Gravação (auditoria do vínculo product↔técnica)
      'print_area_techniques', 'v_print_area_techniques_public',
      'tabela_preco_gravacao_oficial', 'tabela_preco_gravacao_oficial_faixa',
      'tecnicas_gravacao', 'v_audit_paradoxos_gravacao',
    ];

    const results: Array<{ name: string; exists: boolean; columns: string[]; rowCount: number; error?: string }> = [];

    const batchSize = 10;
    for (let i = 0; i < tablesToTest.length; i += batchSize) {
      const batch = tablesToTest.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (tbl) => {
          try {
            const { data, error, count } = await externalSupabase
              .from(tbl)
              .select('*', { count: 'exact', head: false })
              .limit(1);

            if (error) {
              return { name: tbl, exists: false, columns: [], rowCount: 0, error: error.message };
            }
            return {
              name: tbl,
              exists: true,
              columns: data?.length ? Object.keys(data[0]) : [],
              rowCount: count || 0,
            };
          } catch (err) {
            return { name: tbl, exists: false, columns: [], rowCount: 0, error: err instanceof Error ? err.message : 'Erro' };
          }
        })
      );
      results.push(...batchResults);
    }

    const existingTables = results.filter(r => r.exists);
    const missingTables = results.filter(r => !r.exists);

    return jsonResponse({
      success: true,
      summary: {
        total_tested: results.length,
        existing: existingTables.length,
        missing: missingTables.length,
      },
      existingTables: existingTables.map(t => ({ name: t.name, columns: t.columns, rowCount: t.rowCount })),
      missingTables: missingTables.map(t => ({ name: t.name, error: t.error })),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[INSPECT] Error:', errorMessage);
    return jsonResponse({ error: errorMessage }, 500);
  }
});
