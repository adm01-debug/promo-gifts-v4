/**
 * Fonte canonica da logica "Novidade X dias".
 *
 * Extraida de ProductCardImage e ProductStatusBadge para eliminar a formula
 * duplicada (30 - elapsed) que vivia em 4 pontos. O contrato e travado pelo
 * teste novelty-days.test.ts, que passa a importar daqui em vez de
 * reimplementar a mesma conta.
 */
export const NOVELTY_WINDOW_DAYS = 30;
export const MS_PER_DAY = 86400000;

/**
 * Resolve quantos dias restam na janela de novidade.
 * - Usa o valor explicito quando fornecido.
 * - Senao, deriva de created_at (somente se newArrival e a data for parseavel).
 * - Datas futuras (elapsed < 0 => remaining > 30) e produtos fora da janela
 *   ([1..30]) retornam undefined (sem badge).
 */
export function resolveNoveltyDaysRemaining(
  createdAt: string | null | undefined,
  explicitDaysRemaining: number | undefined,
  newArrival: boolean,
): number | undefined {
  let resolved = explicitDaysRemaining;
  if (resolved === undefined && newArrival && createdAt) {
    const ts = Date.parse(createdAt);
    if (!Number.isNaN(ts)) {
      const elapsed = Math.floor((Date.now() - ts) / MS_PER_DAY);
      const remaining = NOVELTY_WINDOW_DAYS - elapsed;
      if (remaining > 0 && remaining <= NOVELTY_WINDOW_DAYS) resolved = remaining;
    }
  }
  return resolved;
}

/** Dias decorridos na janela (0 quando indefinido). */
export function noveltyDaysElapsed(daysRemaining: number | undefined): number {
  // FIX (auditoria Novidades 2026-06-18): clamp em 0. Sem ele, daysRemaining
  // maior que a janela (ex.: 55 na janela real ~60d da pipeline) produzia
  // "Novidade -25 dias" e caía em faixa de cor errada.
  return Math.max(0, daysRemaining !== undefined ? NOVELTY_WINDOW_DAYS - daysRemaining : 0);
}

/** Rótulo do badge "Novidade ..." a partir dos DIAS DECORRIDOS (a idade). */
export function noveltyBadgeLabelFromElapsed(daysElapsed: number): string {
  const e = Math.max(0, daysElapsed);
  if (e === 0) return 'Novidade hoje!';
  if (e === 1) return 'Novidade 1 dia';
  return `Novidade ${e} dias`;
}

/** Rotulo do badge "Novidade ..." a partir dos dias restantes. */
export function noveltyBadgeLabel(daysRemaining: number | undefined): string {
  return noveltyBadgeLabelFromElapsed(noveltyDaysElapsed(daysRemaining));
}
