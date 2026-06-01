/**
 * ExplainModeContext — Onda 14
 *
 * "Ver como calculamos": estado global (persistido em localStorage) que
 * habilita tooltips detalhados em KPIs do hub de Conexões mostrando
 * fórmula, janela de tempo, fonte de dados e thresholds.
 *
 * Quando ativo:
 *  - Tooltips ganham seções: Fórmula · Janela · Fonte · Threshold
 *  - Ícones de info ficam visíveis ao lado dos valores
 *  - shortcut: pressionar "?" alterna o modo
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface ExplainModeContextValue {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (v: boolean) => void;
}

const STORAGE_KEY = 'connections.explain-mode';
const ExplainModeContext = createContext<ExplainModeContextValue | null>(null);

export function ExplainModeProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
    } catch {
      /* noop */
    }
  }, []);

  const toggle = useCallback(() => setEnabled(!enabled), [enabled, setEnabled]);

  // Atalho global: "?" alterna o modo (não dispara em inputs/textareas)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      )
        return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const value = useMemo(() => ({ enabled, toggle, setEnabled }), [enabled, toggle, setEnabled]);
  return <ExplainModeContext.Provider value={value}>{children}</ExplainModeContext.Provider>;
}

export function useExplainMode(): ExplainModeContextValue {
  const ctx = useContext(ExplainModeContext);
  if (!ctx) {
    // Fallback seguro fora do provider — modo sempre desabilitado
    return { enabled: false, toggle: () => {}, setEnabled: () => {} };
  }
  return ctx;
}
