/**
 * Pre-warming de conexões PostgREST nativas — Caminho B.
 *
 * Após a descontinuação do `external-db-bridge` (PRs #230-232), o prewarm
 * passou a consultar o PostgREST nativo diretamente via `supabase.from(table)`.
 * Isso reutiliza o connection pool já ativo do cliente Supabase — sem invoke,
 * sem edge function, sem overhead TLS extra.
 *
 * Comportamento idêntico ao anterior:
 *  - Cooldown de 5 min entre prewarms
 *  - oncePerSession via sessionStorage
 *  - Promise.allSettled para paralelismo
 */
import { untypedFrom } from '@/lib/supabase-untyped';
import { logger } from '@/lib/logger';

type PrewarmTable =
  | 'categories'
  | 'color_groups'
  | 'product_images'
  | 'product_variants'
  | 'products'
  | 'suppliers';

// Tabelas principais que convém ter no pool antes do primeiro uso
const PREWARM_TABLES: readonly PrewarmTable[] = [
  'products',
  'product_images',
  'product_variants',
  'categories',
  'suppliers',
  'color_groups',
];

let lastPrewarmAt = 0;
const PREWARM_COOLDOWN_MS = 5 * 60 * 1000;
const SESSION_KEY = '__pg_prewarm_done__';

/**
 * Aquece as tabelas via PostgREST nativo (Caminho B — sem bridge).
 * SELECT id LIMIT 1 é suficiente para abrir a conexão no pool.
 */
async function warmAllTables(
  tables: readonly PrewarmTable[],
): Promise<Array<{ table: PrewarmTable; ok: boolean; ms: number; err?: string }>> {
  const t0 = performance.now();

  const results = await Promise.allSettled(
    tables.map((table) => untypedFrom(table).select('id').limit(1)),
  );

  const totalMs = Math.round(performance.now() - t0);

  return tables.map((table, idx) => {
    const r = results[idx];
    if (r.status === 'rejected') {
      return { table, ok: false, ms: totalMs, err: String(r.reason) };
    }
    return {
      table,
      ok: !r.value.error,
      ms: totalMs,
      err: r.value.error?.message,
    };
  });
}

/**
 * Opções do prewarm.
 *  - `force`: ignora cooldown E sessionStorage (uso interno/debug)
 *  - `oncePerSession`: respeita flag em sessionStorage (default false).
 *    Quando true, dispara no máximo 1x por sessão de browser.
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
  logger.log('[Prewarm] Warming up PostgREST connections (Caminho B — native)...');

  const batchResults = await warmAllTables(PREWARM_TABLES);

  const totalMs = Math.round(performance.now() - totalStart);
  let okCount = 0;
  let failCount = 0;

  for (const r of batchResults) {
    if (r.ok) {
      okCount++;
      logger.log(`[Prewarm] ✅ ${r.table} warmed (${r.ms}ms)`);
    } else {
      failCount++;
      logger.warn(`[Prewarm] ⚠️ ${r.table} failed: ${r.err}`);
    }
  }

  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore */
  }

  logger.log(`[Prewarm] Done in ${totalMs}ms — ok=${okCount} fail=${failCount} (PostgREST native)`);
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
