/**
 * Daily Catalog Defaults
 *
 * Regra de negócio do PO: no primeiro acesso DO DIA ao catálogo, os defaults
 * devem ser restaurados — independente do que o usuário tinha persistido
 * antes:
 *  - viewMode  → 'grid'
 *  - colunas   → 6 (ou o máximo cabível em telas pequenas)
 *  - sortBy    → 'newest' (Mais recentes)
 *
 * Implementação: marcamos a data (YYYY-MM-DD em horário local do navegador)
 * em localStorage. Se a marca de hoje ainda não existe, sobrescrevemos as
 * chaves de preferência e gravamos a marca. Idempotente — pode ser chamado
 * em todo render do hook sem custo após o primeiro do dia.
 *
 * As constantes de chave são importadas dos próprios componentes para evitar
 * drift (ColumnSelector.STORAGE_KEY, useCatalogState VIEW_MODE_KEY/SORT_SESSION_KEY).
 */
import { STORAGE_KEY as GRID_COLUMNS_KEY } from '@/components/products/ColumnSelector';

export const DAILY_RESET_KEY = 'catalog:daily-reset:last-date';
export const CATALOG_VIEW_MODE_KEY = 'catalog-view-mode';
export const CATALOG_SORT_SESSION_KEY = 'catalog:sortBy';

/** YYYY-MM-DD em horário local — chave estável para reset diário. */
function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Aplica os defaults do dia se ainda não foram aplicados hoje.
 * Retorna `true` se reset foi executado (útil para testes/telemetria).
 */
export function ensureDailyCatalogDefaults(now: Date = new Date()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const today = todayKey(now);
    const last = window.localStorage.getItem(DAILY_RESET_KEY);
    if (last === today) return false;

    // Defaults exigidos pelo PO:
    window.localStorage.setItem(CATALOG_VIEW_MODE_KEY, 'grid');
    // 6 colunas. Em telas estreitas o ColumnSelector renderiza apenas
    // opções viáveis (filtra por minWidth); o catálogo ainda assim
    // tentará usar 6 se a tela suportar, caindo no responsivo nativo
    // do grid quando não suportar.
    window.localStorage.setItem(GRID_COLUMNS_KEY, '6');
    // sortBy é sessionStorage (vida do navegador) — limpamos para que
    // a próxima leitura caia em 'newest' (default validado no hook).
    try {
      window.sessionStorage.removeItem(CATALOG_SORT_SESSION_KEY);
    } catch {
      /* sessionStorage indisponível — ok */
    }

    window.localStorage.setItem(DAILY_RESET_KEY, today);
    return true;
  } catch {
    return false;
  }
}
