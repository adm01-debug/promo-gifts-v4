/**
 * Utilitários de data compartilhados entre os componentes de novidades.
 * ISSUE-36 FIX: elimina duplicação de formatDaysAgo entre ExpiringNoveltiesWidget
 * e NoveltiesSection (funções idênticas definidas localmente em cada componente).
 */

/**
 * Formata "há quantos dias" a partir de um timestamp ISO ou Date.
 * Usa UTC para evitar off-by-one em fusos como UTC+10 próximos da meia-noite.
 */
export function formatDaysAgoFromTs(ts: string | number | Date): string {
  const date = ts instanceof Date ? ts : new Date(ts);
  const msPerDay = 86400000;
  const days = Math.floor((Date.now() - date.getTime()) / msPerDay);
  if (days === 0) return 'Hoje!';
  if (days === 1) return 'Ontem';
  return `${days}d atrás`;
}

/**
 * Formata "há quantos dias" a partir de um contador de dias já calculado.
 */
export function formatDaysAgoFromCount(daysElapsed: number): string {
  if (daysElapsed === 0) return 'Hoje!';
  if (daysElapsed === 1) return 'Ontem';
  return `${daysElapsed}d atrás`;
}

/**
 * Variante de frescor para badges de recência (hot/warm/normal).
 * ISSUE-34 NOTE: chamar em cada render (não memoizar) garante que a variante
 * se atualiza corretamente quando o componente re-renderiza pelo tick de 1min.
 */
export function getRecencyVariant(ts: string | number | Date): 'hot' | 'warm' | 'normal' {
  const date = ts instanceof Date ? ts : new Date(ts);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 2) return 'hot';
  if (days <= 5) return 'warm';
  return 'normal';
}
