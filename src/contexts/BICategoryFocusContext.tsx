/**
 * BICategoryFocusContext — foco global de categoria no módulo BI.
 *
 * Quando o vendedor clica numa categoria do `ClientCategoryRadar`, o slug
 * é propagado para os componentes consumidores (`IndustryTrendingProducts`,
 * `BundleSuggestions`, `ClientAffinityProducts`) para destacar/filtrar a
 * categoria escolhida em todo o painel. Botão "Limpar foco" no header.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { BICategorySlug } from '@/lib/bi/categoryResolver';

export type FocusedCategorySlug = BICategorySlug | 'outros' | null;

interface BICategoryFocusContextValue {
  focusedSlug: FocusedCategorySlug;
  focusedLabel: string | null;
  setFocus: (slug: FocusedCategorySlug, label?: string | null) => void;
  clear: () => void;
}

const BICategoryFocusContext = createContext<BICategoryFocusContextValue | null>(null);

export function BICategoryFocusProvider({ children }: { children: ReactNode }) {
  const [focusedSlug, setFocusedSlug] = useState<FocusedCategorySlug>(null);
  const [focusedLabel, setFocusedLabel] = useState<string | null>(null);

  const setFocus = useCallback((slug: FocusedCategorySlug, label?: string | null) => {
    setFocusedSlug(slug);
    setFocusedLabel(label ?? null);
  }, []);

  const clear = useCallback(() => {
    setFocusedSlug(null);
    setFocusedLabel(null);
  }, []);

  const value = useMemo(
    () => ({ focusedSlug, focusedLabel, setFocus, clear }),
    [focusedSlug, focusedLabel, setFocus, clear],
  );

  return (
    <BICategoryFocusContext.Provider value={value}>{children}</BICategoryFocusContext.Provider>
  );
}

/** Sempre seguro: retorna no-op quando fora de provider (evita quebrar consumidores). */
export function useBICategoryFocus(): BICategoryFocusContextValue {
  const ctx = useContext(BICategoryFocusContext);
  if (ctx) return ctx;
  return {
    focusedSlug: null,
    focusedLabel: null,
    setFocus: () => {},
    clear: () => {},
  };
}
