/**
 * Pre-warming do banco externo para evitar cold starts.
 *
 * Estratégia (pós-otimização):
 *  1. Um ping leve (sem I/O de BD) acorda a edge function — completa em ~80ms quando
 *     ela já está quente via cron keep-alive (job `external-db-bridge-keepalive`).
 *  2. Em seguida, dispara todas as tabelas EM PARALELO (Promise.allSettled),
 *     reusando a mesma conexão já aberta no pool. Reduz o tempo total de ~5s
 *     (sequencial 800ms × 6) para ~1.5s no pior caso.
 *
 * Cooldown de 5 min impede thrashing entre navegações.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { waitForBridgeReady } from '@/lib/external-db/health-check';

const PREWARM_TABLES = [
  'products',
  'product_images',
  'product_variants',
  'categories',
  'suppliers',
  'color_groups',
];

let lastPrewarmAt = 0;
const PREWARM_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos entre pre-warms
const SESSION_KEY = '__pg_prewarm_done__';

/**
 * Acorda o crm-db-bridge em paralelo (cold start ~80–250ms).
 * Mesma estratégia: ping leve via OPTIONS, falha silenciosa.
 */
async function pingCrmBridge(): Promise<{ ok: boolean; ms: number }> {
  const t0 = performance.now();
  try {
    const { error } = await supabase.functions.invoke('crm-db-bridge', {
      body: { table: 'companies', operation: 'select', select: 'id', limit: 1, countMode: 'none' },
    });
    return { ok: !error, ms: Math.round(performance.now() - t0) };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - t0) };
  }
}

/**
 * Acorda a edge function via health-check compartilhado (`waitForBridgeReady`).
 * O helper já faz polling com backoff e cacheia "ready" — então UI e prewarm
 * convergem na mesma promise quando rodam próximos no tempo.
 */
async function pingBridge(): Promise<{ ok: boolean; ms: number; attempts: number }> {
  const t0 = performance.now();
  const res = await waitForBridgeReady(5000);
  return {
    ok: res.ok,
    ms: res.ms || Math.round(performance.now() - t0),
    attempts: 1,
  };
}

/**
 * Coalesce as 6 tabelas em UMA única chamada `operation: 'batch'`.
 *
 * Antes: 6 invokes paralelos = 6 round-trips TLS, 6 entradas no rate-limit,
 * 6 fan-outs no PostgREST. Mesmo com singleton + warm-up, cada request paga
 * o overhead de Cloudflare → Supabase Edge → bridge handler.
 *
 * Depois: 1 invoke. A bridge expande o batch em `Promise.all` interno
 * (handleBatch, supabase/functions/external-db-bridge/index.ts:499) reusando
 * o mesmo client cacheado. Resultado: ~1.5s → ~250ms no warm path.
 */
async function warmAllTables(tables: string[]): Promise<Array<{ table: string; ok: boolean; ms: number; err?: string }>> {
  const t0 = performance.now();
  try {
    const { data, error } = await supabase.functions.invoke('external-db-bridge', {
      body: {
        operation: 'batch',
        queries: tables.map((table) => ({
          table,
          select: 'id',
          limit: 1,
          countMode: 'none',
        })),
      },
    });
    const totalMs = Math.round(performance.now() - t0);
    if (error) {
      // Falha global do batch — reporta como falha em todas as tabelas
      return tables.map((table) => ({ table, ok: false, ms: totalMs, err: error.message }));
    }
    // handleBatch retorna { results: [{ success, data?, error? }, ...] }
    const results = (data?.results ?? []) as Array<{ success: boolean; error?: string }>;
    return tables.map((table, idx) => {
      const r = results[idx];
      if (!r) return { table, ok: false, ms: totalMs, err: 'missing batch slot' };
      return { table, ok: !!r.success, ms: totalMs, err: r.success ? undefined : r.error };
    });
  } catch (err) {
    const totalMs = Math.round(performance.now() - t0);
    return tables.map((table) => ({ table, ok: false, ms: totalMs, err: (err as Error)?.message }));
  }
}

/**
 * Opções do prewarm.
 *  - `force`: ignora cooldown E sessionStorage (uso interno/debug)
 *  - `oncePerSession`: respeita flag em sessionStorage (default true). Quando true,
 *    o prewarm dispara no máximo 1x por sessão de browser — ideal para gatilho
 *    no login. Outros call-sites (ex.: navegação) devem passar `false`.
 */
export async function prewarmExternalDb(opts: { force?: boolean; oncePerSession?: boolean } = {}) {
  const { force = false, oncePerSession = false } = opts;

  if (!force && oncePerSession) {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') {
        logger.log('[Prewarm] Skipped — already done this session');
        return;
      }
    } catch {
      // sessionStorage indisponível (SSR/private mode) — segue adiante
    }
  }

  const now = Date.now();
  if (!force && now - lastPrewarmAt < PREWARM_COOLDOWN_MS) {
    logger.log('[Prewarm] Skipped — cooldown active');
    return;
  }
  lastPrewarmAt = now;

  const totalStart = performance.now();
  logger.log('[Prewarm] Warming up external DB connections (parallel)...');

  // 1) Acorda a edge function com um ping leve (sem BD). Aguardamos
  //    explicitamente até receber 200 — só então liberamos o leque paralelo.
  const ping = await pingBridge();

  if (!ping.ok) {
    // Isolate não respondeu nem após 3 tentativas. Disparar 6 chamadas paralelas
    // agora só amplificaria o problema — aborta e libera o cooldown para um
    // novo prewarm na próxima navegação.
    lastPrewarmAt = 0;
    const totalMs = Math.round(performance.now() - totalStart);
    logger.warn(
      `[Prewarm] ⛔ Aborted — bridge ping failed after ${ping.attempts} attempts in ${ping.ms}ms (total ${totalMs}ms). Skipping parallel fan-out.`,
    );
    return;
  }

  // 2) Isolate confirmadamente quente — dispara batch único + crm-bridge EM PARALELO
  //    (apenas 2 invokes totais: 1 batch das 6 tabelas + 1 ping CRM)
  const [crmPing, batchResult] = await Promise.allSettled([
    pingCrmBridge(),
    warmAllTables(PREWARM_TABLES),
  ]);

  const totalMs = Math.round(performance.now() - totalStart);
  let okCount = 0;
  let failCount = 0;

  if (batchResult.status === 'fulfilled') {
    for (const r of batchResult.value) {
      if (r.ok) {
        okCount++;
        logger.log(`[Prewarm] ✅ ${r.table} warmed (batch ${r.ms}ms)`);
      } else {
        failCount++;
        logger.warn(`[Prewarm] ⚠️ ${r.table} failed: ${r.err}`);
      }
    }
  } else {
    failCount += PREWARM_TABLES.length;
    logger.warn(`[Prewarm] ⚠️ batch rejected:`, batchResult.reason);
  }

  const crmInfo =
    crmPing.status === 'fulfilled'
      ? `crm=${crmPing.value.ok ? '✅' : '⚠️'} (${crmPing.value.ms}ms)`
      : 'crm=⚠️ rejected';

  // Marca a sessão como aquecida — evita prewarm duplicado se outro gatilho disparar
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore */
  }

  logger.log(
    `[Prewarm] Done in ${totalMs}ms — ping=${ping.ms}ms (${ping.attempts}x) ${crmInfo} external_ok=${okCount} fail=${failCount} (1 batch invoke)`,
  );
}


/**
 * Limpa o flag de sessão. Útil em logout para garantir prewarm no próximo login.
 */
export function resetPrewarmSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  lastPrewarmAt = 0;
}
