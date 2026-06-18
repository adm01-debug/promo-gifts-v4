import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { getCredential } from '../_shared/credentials.ts';
import { authorizeCron } from '../_shared/dispatcher-auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { safeErrorFields } from '../_shared/log-safety.ts';

// CORS headers are now dynamic — use getCorsHeaders(req) inside the handler
// See _shared/cors.ts for the centralized configuration

Deno.serve(async (req) => {
  // Cron: exige x-cron-secret para evitar chamadas diretas não autorizadas
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  const cronAuth = await authorizeCron(req, {
    corsHeaders: {},
    secretEnvName: 'CRON_SECRET',
    headerName: 'x-cron-secret',
  });
  if (!cronAuth.ok) return cronAuth.response;

  const corsHeaders = getCorsHeaders(req);

  console.log('🧹 Iniciando limpeza de flags expirados...');

  try {
    // Cliente do banco LOCAL (Lovable Cloud) para RPC de novidades
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Cliente do banco EXTERNO (Promobrind) para flags de produto
    // fix: ssot-bypass — credential vault
    const externalUrl = await getCredential('EXTERNAL_PROMOBRIND_URL');
    const externalKey = await getCredential('EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY');

    const results: Record<string, number> = {};
    const now = new Date().toISOString();

    // 1) Limpar novidades expiradas no banco LOCAL (legado)
    try {
      const { data } = await supabase.rpc('cleanup_expired_novelties');
      results.local_novelties_cleaned = data || 0;
      console.log(`✅ Novidades locais limpas: ${results.local_novelties_cleaned}`);
    } catch (e) {
      console.log('ℹ️ cleanup_expired_novelties RPC não disponível (ok se não existir)');
    }

    // 2) Limpar flags expirados no banco EXTERNO
    if (externalUrl && externalKey) {
      const externalDb = createClient(externalUrl, externalKey);

      // Definição dos flags e seus campos de expiração
      const flagConfigs = [
        { flag: 'is_featured', expiresField: 'is_featured_expires_at' },
        { flag: 'is_bestseller', expiresField: 'is_bestseller_expires_at' },
        { flag: 'is_new', expiresField: 'is_new_expires_at' },
        { flag: 'is_on_sale', expiresField: 'is_on_sale_expires_at' },
      ];

      for (const { flag, expiresField } of flagConfigs) {
        try {
          // Buscar produtos com flag ativo E data de expiração vencida
          const { data: expiredProducts, error: selectError } = await externalDb
            .from('products')
            .select('id')
            .eq(flag, true)
            .not(expiresField, 'is', null)
            .lt(expiresField, now)
            .limit(500);

          if (selectError) {
            // Coluna pode não existir ainda - degradação graciosa
            console.log(`⚠️ Coluna ${expiresField} pode não existir`, safeErrorFields(selectError));
            results[`${flag}_error`] = 0;
            continue;
          }

          if (!expiredProducts || expiredProducts.length === 0) {
            results[`${flag}_cleaned`] = 0;
            continue;
          }

          // Desativar o flag e limpar a data de expiração
          const ids = expiredProducts.map((p) => p.id);
          const updateData: Record<string, any> = {
            [flag]: false,
            [expiresField]: null,
            updated_at: now,
          };

          let updatedCount = 0;
          // Atualizar em lotes de 50
          for (let i = 0; i < ids.length; i += 50) {
            const batch = ids.slice(i, i + 50);
            const { error: updateError } = await externalDb
              .from('products')
              .update(updateData)
              .in('id', batch);

            if (updateError) {
              console.error(
                `❌ Erro ao desativar ${flag} para lote:`,
                safeErrorFields(updateError),
              );
            } else {
              updatedCount += batch.length;
            }
          }

          results[`${flag}_cleaned`] = updatedCount;
          console.log(`✅ ${flag}: ${updatedCount} produtos desativados (expirados)`);

          console.log(`${flag}: produtos afetados`, { count: expiredProducts.length });
        } catch (err: any) {
          console.error(`❌ Erro processando ${flag}:`, safeErrorFields(err));
          results[`${flag}_error`] = 0;
        }
      }
    } else {
      console.log('⚠️ Banco externo não configurado - pulando limpeza de flags');
    }

    // 3) Limpar logs antigos
    try {
      const { data: logsDeleted } = await supabase.rpc('cleanup_old_logs');
      if (logsDeleted) {
        console.log(`🗑️ ${logsDeleted} logs antigos removidos.`);
      }
    } catch {
      // Ignorar se a função não existir
    }

    const totalCleaned = Object.values(results).reduce(
      (sum, v) => sum + (typeof v === 'number' ? v : 0),
      0,
    );

    console.log(`✅ Limpeza concluída! Total: ${totalCleaned} registros processados.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Limpeza concluída com sucesso`,
        results,
        total_cleaned: totalCleaned,
        executed_at: now,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro na limpeza de flags:', safeErrorFields(error));

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        executed_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
