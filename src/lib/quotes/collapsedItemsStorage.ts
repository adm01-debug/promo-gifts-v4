/**
 * SSOT da persistência do estado de colapso dos cards de produto no Resumo
 * do Quote Builder.
 *
 * Regras invioláveis:
 *  - Chave por orçamento: `quote-builder:collapsed-item-keys:${quoteId ?? 'new'}`.
 *    Nunca compartilhe estado entre orçamentos distintos.
 *  - `quoteId` ausente/nulo/`undefined`/string vazia ⇒ fallback `'new'` (rascunho).
 *  - Toda I/O em `localStorage` é defensiva: nunca lança (quota, modo privado,
 *    SSR, JSON corrompido). Em erro de leitura, devolve `Set` vazio.
 *  - `pruneToIds` remove chaves órfãs (itens excluídos ou ids inexistentes),
 *    evitando crescimento ilimitado e estados zumbis.
 *
 * Cobertura: `collapsedItemsStorage.test.ts` (centenas de simulações).
 */

export const COLLAPSED_ITEMS_KEY_PREFIX = 'quote-builder:collapsed-item-keys';
export const NEW_QUOTE_FALLBACK = 'new';

/** Normaliza qualquer valor de `quoteId` para um sufixo de chave seguro. */
export function normalizeQuoteId(quoteId: string | null | undefined): string {
  if (typeof quoteId !== 'string') return NEW_QUOTE_FALLBACK;
  const trimmed = quoteId.trim();
  return trimmed.length > 0 ? trimmed : NEW_QUOTE_FALLBACK;
}

export function collapsedItemsStorageKey(quoteId: string | null | undefined): string {
  return `${COLLAPSED_ITEMS_KEY_PREFIX}:${normalizeQuoteId(quoteId)}`;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Lê o conjunto persistido. Sempre devolve um `Set` (vazio em qualquer falha). */
export function loadCollapsedItems(quoteId: string | null | undefined): Set<string> {
  const store = safeStorage();
  if (!store) return new Set();
  try {
    const raw = store.getItem(collapsedItemsStorageKey(quoteId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    // Filtra entradas inválidas (não-strings, vazias) — JSON corrompido externo.
    return new Set(parsed.filter((v): v is string => typeof v === 'string' && v.length > 0));
  } catch {
    return new Set();
  }
}

/** Persiste o conjunto. Conjunto vazio ⇒ remove a chave (não polui storage). */
export function saveCollapsedItems(
  quoteId: string | null | undefined,
  set: ReadonlySet<string>,
): void {
  const store = safeStorage();
  if (!store) return;
  const key = collapsedItemsStorageKey(quoteId);
  try {
    if (set.size === 0) {
      store.removeItem(key);
      return;
    }
    store.setItem(key, JSON.stringify([...set]));
  } catch {
    /* noop — quota/modo privado */
  }
}

/** Alterna uma chave e persiste atomicamente. Devolve o novo `Set`. */
export function toggleCollapsedItem(
  quoteId: string | null | undefined,
  current: ReadonlySet<string>,
  key: string,
): Set<string> {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  saveCollapsedItems(quoteId, next);
  return next;
}

/**
 * Remove do estado persistido qualquer chave que não esteja em `currentItemIds`.
 * Devolve o `Set` "limpo" e persiste apenas se houve mudança (evita writes).
 *
 * Use após mudar `items` (excluir/adicionar produto) para garantir que o
 * storage não acumule ids zumbis ao longo do tempo.
 */
export function pruneCollapsedItems(
  quoteId: string | null | undefined,
  current: ReadonlySet<string>,
  currentItemIds: Iterable<string>,
): Set<string> {
  const valid = new Set(currentItemIds);
  const next = new Set<string>();
  let changed = false;
  for (const k of current) {
    if (valid.has(k)) next.add(k);
    else changed = true;
  }
  if (changed) saveCollapsedItems(quoteId, next);
  return changed ? next : new Set(current);
}
