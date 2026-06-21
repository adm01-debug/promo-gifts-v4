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
    const PAGE = 500; // tamanho de página para paginação completa
    const UPDATE_BATCH = 50;
    // HARDENING (auditoria Novidades 2026-06-20): guarda anti-loop infinito para os
    // laços de paginação abaixo. Se um UPDATE falhar de forma PERSISTENTE numa página
    // cheia, o SELECT seguinte re-traria as MESMAS linhas (flag ainda true) e o
    // while(true) giraria até o timeout de 55s do cron. Espelha o MAX_PAGES dos hooks
    // de novidades (useNovelties.ts, ISSUE-8). 1000 × 500 = 500k linhas/laço — ordens
    // de grandeza acima de qualquer lote diário de expiração, então nunca trunca
    // trabalho legítimo; só impede o giro infinito.
    const MAX_LOOP_PAGES = 1000;

    // Utilitário: limpa um flag expirado em um banco específico, com paginação completa
    async function cleanExpiredFlag(
      db: ReturnType<typeof createClient>,
      dbLabel: string,
      flag: string,
      expiresField: string,
      extraClearFields: string[] = [],
    ): Promise<number> {
      let totalCleaned = 0;
      let pageGuard = 0;
      while (true) {
        if (pageGuard++ >= MAX_LOOP_PAGES) {
          console.warn(
            `⚠️ [${dbLabel}] ${flag}: limite de ${MAX_LOOP_PAGES} páginas atingido — abortando laço (possível UPDATE falhando em loop)`,
          );
          break;
        }
        const { data: expired, error: selectError } = await db
          .from('products')
          .select('id')
          .eq(flag, true)
          .not(expiresField, 'is', null)
          .lt(expiresField, now)
          .limit(PAGE);

        if (selectError) {
          console.log(
            `⚠️ [${dbLabel}] Coluna ${expiresField} pode não existir`,
            safeErrorFields(selectError),
          );
          break;
        }
        if (!expired || expired.length === 0) break;

        const updateData: Record<string, unknown> = {
          [flag]: false,
          [expiresField]: null,
          updated_at: now,
        };
        for (const field of extraClearFields) updateData[field] = null;

        const ids = expired.map((p: { id: string }) => p.id);
        for (let i = 0; i < ids.length; i += UPDATE_BATCH) {
          const batch = ids.slice(i, i + UPDATE_BATCH);
          const { error: updateError } = await db
            .from('products')
            .update(updateData)
            .in('id', batch);
          if (updateError) {
            console.error(
              `❌ [${dbLabel}] Erro ao desativar ${flag}:`,
              safeErrorFields(updateError),
            );
          } else {
            totalCleaned += batch.length;
          }
        }

        if (expired.length < PAGE) break; // última página — não há mais registros
      }
      return totalCleaned;
    }

    // 1) Sincronizar product_novelties: desativar registros expirados antes de limpar products.
    //    BUG-FIX: o passo anterior usava a RPC cleanup_expired_novelties (best-effort DELETE)
    //    que poderia falhar silenciosamente. Sem este passo, produtos que expiram na janela
    //    03:00–04:05 ficavam com product_novelties.is_active=true enquanto products.is_new
    //    já era false (passo 2 abaixo), causando reativação indevida pela
    //    fn_reactivate_valid_novelties (Frente 3) na hora seguinte — ghost novelty de ~22h.
    try {
      let pnCleaned = 0;
      let pnPageGuard = 0;
      while (true) {
        if (pnPageGuard++ >= MAX_LOOP_PAGES) {
          console.warn(
            `⚠️ product_novelties: limite de ${MAX_LOOP_PAGES} páginas atingido — abortando laço (possível UPDATE falhando em loop)`,
          );
          break;
        }
        const { data: expiredPn, error: pnSelectErr } = await supabase
          .from('product_novelties')
          .select('id')
          .eq('is_active', true)
          .not('expires_at', 'is', null)
          .lt('expires_at', now)
          .limit(PAGE);
        if (pnSelectErr) {
          console.log('⚠️ product_novelties select error:', safeErrorFields(pnSelectErr));
          break;
        }
        if (!expiredPn || expiredPn.length === 0) break;
        const pnIds = (expiredPn as { id: string }[]).map((r) => r.id);
        for (let i = 0; i < pnIds.length; i += UPDATE_BATCH) {
          const batch = pnIds.slice(i, i + UPDATE_BATCH);
          const { error: pnUpdateErr } = await supabase
            .from('product_novelties')
            .update({ is_active: false, updated_at: now })
            .in('id', batch);
          if (pnUpdateErr) {
            console.error('❌ Erro desativando product_novelties:', safeErrorFields(pnUpdateErr));
          } else {
            pnCleaned += batch.length;
          }
        }
        if (expiredPn.length < PAGE) break;
      }
      results.product_novelties_synced = pnCleaned;
      console.log(`✅ product_novelties sincronizados: ${pnCleaned} registros`);
    } catch (err) {
      console.error('❌ Erro sincronizando product_novelties:', safeErrorFields(err));
      results.product_novelties_synced = 0;
    }

    // 2) Limpar is_new expirado no banco LOCAL via novelty_expires_at
    //    O banco Gold usa novelty_expires_at (não is_new_expires_at).
    //    Também zera novelty_detected_at para limpar a janela de novidade.
    try {
      const localCleaned = await cleanExpiredFlag(
        supabase,
        'local',
        'is_new',
        'novelty_expires_at',
        ['novelty_detected_at'],
      );
      results.local_is_new_cleaned = localCleaned;
      console.log(`✅ is_new local (novelty_expires_at): ${localCleaned} produtos desativados`);
    } catch (err) {
      console.error('❌ Erro limpando is_new local:', safeErrorFields(err));
      results.local_is_new_cleaned = 0;
    }

    // 3) Limpar flags expirados no banco EXTERNO (Promobrind)
    if (externalUrl && externalKey) {
      const externalDb = createClient(externalUrl, externalKey);

      // is_new no externo usa is_new_expires_at (schema Promobrind)
      const flagConfigs = [
        { flag: 'is_featured', expiresField: 'is_featured_expires_at' },
        { flag: 'is_bestseller', expiresField: 'is_bestseller_expires_at' },
        { flag: 'is_new', expiresField: 'is_new_expires_at' },
        { flag: 'is_on_sale', expiresField: 'is_on_sale_expires_at' },
      ];

      for (const { flag, expiresField } of flagConfigs) {
        try {
          const count = await cleanExpiredFlag(externalDb, 'externo', flag, expiresField);
          results[`ext_${flag}_cleaned`] = count;
          console.log(`✅ [externo] ${flag}: ${count} produtos desativados`);
        } catch (err) {
          console.error(`❌ [externo] Erro processando ${flag}:`, safeErrorFields(err));
          results[`ext_${flag}_error`] = 0;
        }
      }
    } else {
      console.log('⚠️ Banco externo não configurado - pulando limpeza de flags');
    }

    // 4) Limpar logs antigos
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
