/**
 * useFutureStockPreference
 * Persiste a preferência do usuário para o toggle "Estoque Futuro"
 * (ligado/desligado + janela de 7/15/30 dias) em localStorage.
 *
 * SSOT do storage key e dos valores válidos para a janela.
 * Defensivo contra SSR, JSON inválido e janelas fora do conjunto permitido.
 */
import { useEffect, useRef } from 'react';

export const FUTURE_STOCK_STORAGE_KEY = 'stock-filter:future-stock-pref:v1';
export const FUTURE_STOCK_WINDOWS = [7, 15, 30] as const;
export type FutureStockWindow = (typeof FUTURE_STOCK_WINDOWS)[number];

export interface FutureStockPreference {
  includeFutureStock: boolean;
  futureStockWindowDays: FutureStockWindow;
}

export const DEFAULT_FUTURE_STOCK_PREFERENCE: FutureStockPreference = {
  includeFutureStock: false,
  futureStockWindowDays: 15,
};

export function readFutureStockPreference(): FutureStockPreference {
  if (typeof window === 'undefined') return DEFAULT_FUTURE_STOCK_PREFERENCE;
  try {
    const raw = window.localStorage.getItem(FUTURE_STOCK_STORAGE_KEY);
    if (!raw) return DEFAULT_FUTURE_STOCK_PREFERENCE;
    const parsed = JSON.parse(raw) as Partial<FutureStockPreference> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_FUTURE_STOCK_PREFERENCE;
    const include = Boolean(parsed.includeFutureStock);
    const win = (FUTURE_STOCK_WINDOWS as readonly number[]).includes(
      parsed.futureStockWindowDays as number,
    )
      ? (parsed.futureStockWindowDays as FutureStockWindow)
      : DEFAULT_FUTURE_STOCK_PREFERENCE.futureStockWindowDays;
    return { includeFutureStock: include, futureStockWindowDays: win };
  } catch {
    return DEFAULT_FUTURE_STOCK_PREFERENCE;
  }
}

export function writeFutureStockPreference(pref: FutureStockPreference): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FUTURE_STOCK_STORAGE_KEY, JSON.stringify(pref));
  } catch {
    /* quota/privacy mode — ignora silenciosamente */
  }
}

/**
 * Hook utilitário: hidrata a preferência uma única vez (via callback) e
 * sincroniza qualquer mudança subsequente para o localStorage.
 *
 * Não controla o estado — apenas observa os valores atuais dos filtros
 * e os persiste. A hidratação inicial é feita via `onHydrate` para
 * permitir que o caller integre com seu próprio reducer/store.
 */
export function useFutureStockPreference(
  current: FutureStockPreference,
  onHydrate: (pref: FutureStockPreference) => void,
): void {
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const stored = readFutureStockPreference();
    if (
      stored.includeFutureStock !== current.includeFutureStock ||
      stored.futureStockWindowDays !== current.futureStockWindowDays
    ) {
      onHydrate(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    writeFutureStockPreference(current);
    // BUG-I FIX: depend on primitive values, not the object reference.
    // The caller creates a new object each render, so `[current]` would
    // trigger a localStorage write every render even when values are identical.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.includeFutureStock, current.futureStockWindowDays]);
}

/**
 * Helper estável para registrar atalho de teclado de toggle.
 * Retorna a função de cleanup; ignora eventos disparados dentro de
 * inputs/textarea/contentEditable para não interferir na digitação.
 */
export function useFutureStockShortcut(toggle: () => void, enabled = true): void {
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      // Shift+F (sem Ctrl/Meta/Alt) — não captura atalhos do navegador.
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== 'F' && e.key !== 'f') return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const ceAttr = target.getAttribute?.('contenteditable');
        const isCE =
          target.isContentEditable === true ||
          ceAttr === '' ||
          ceAttr === 'true' ||
          ceAttr === 'plaintext-only';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isCE) {
          return;
        }
      }
      e.preventDefault();
      toggleRef.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
}
