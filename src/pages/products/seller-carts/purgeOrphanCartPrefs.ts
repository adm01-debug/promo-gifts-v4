/**
 * purgeOrphanCartPrefs — remove chaves órfãs do antigo popover
 * "Colunas / Densidade" (removido em 2026-07) do localStorage.
 *
 * Cobre tanto o padrão namespaced (`cart-table-columns:${uid}`,
 * `cart-table-density:${uid}`) quanto chaves legadas sem namespace
 * que possam ter sobrado de builds antigos.
 *
 * Silenciosamente ignora ambientes sem `localStorage` (SSR, modo
 * privado com quota estourada) para não quebrar o carregamento da
 * página.
 *
 * Retorna a lista de chaves efetivamente removidas (útil em testes
 * e telemetria).
 */
const ORPHAN_PREFIXES = ['cart-table-columns', 'cart-table-density'] as const;

export function purgeOrphanCartPrefs(storage?: Storage): string[] {
  const removed: string[] = [];
  try {
    const store =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return removed;

    for (let i = store.length - 1; i >= 0; i--) {
      const key = store.key(i);
      if (!key) continue;
      if (ORPHAN_PREFIXES.some((p) => key === p || key.startsWith(`${p}:`))) {
        store.removeItem(key);
        removed.push(key);
      }
    }
  } catch {
    // localStorage indisponível — ignorar silenciosamente.
  }
  return removed;
}
