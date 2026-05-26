/**
 * Global keyboard shortcuts for power users.
 *
 * Registry (complementa os atalhos Alt+* da sidebar):
 * Ctrl/Cmd + K → Focus search (busca inteligente)
 * Ctrl/Cmd + J → Open Flow (assistente IA)
 * Ctrl/Cmd + Shift + N → New quote
 * Ctrl/Cmd + Shift + C → Open cart
 * ? → Help / Restart Tour
 *
 * Existing Alt shortcuts (sidebar): Alt+N novo orçamento, Alt+O orçamentos,
 *   Alt+R carrinhos, Alt+P produtos, Alt+F super filtro, Alt+M mockup, Alt+S simulador.
 *   Header: Alt+F favoritos, Alt+C comparar, Alt+T tema.
 */
import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOracleVoiceBridge } from '@/stores/oracleVoiceBridge';
import { useSearchStore } from '@/stores/useSearchStore';
import { useOnboardingContext } from '@/contexts/OnboardingContext';

interface ShortcutHandlers {
  onSearchFocus?: () => void;
  onToggleCart?: () => void;
}

// "G then K" sequence buffer (vim-style chord) — opens kit library
let lastGAt = 0;

export function useGlobalShortcuts(handlers?: ShortcutHandlers) {
  const navigate = useNavigate();
  const openOracle = useOracleVoiceBridge((s) => s.openOracle);
  const { open: searchOpen, setOpen: setOpenSearch } = useSearchStore();
  let onboarding: any = null;
  try {
    onboarding = useOnboardingContext();
  } catch (_e) {
    // Context may not be available outside MainLayout
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // G then K (within 800ms) → open kit library — no modifier, ignored in inputs
      if (!isMod && !e.altKey && !e.shiftKey && !isInput) {
        if (e.key === 'g' || e.key === 'G') {
          lastGAt = Date.now();
          return;
        }
        if ((e.key === 'k' || e.key === 'K') && Date.now() - lastGAt < 800) {
          e.preventDefault();
          lastGAt = 0;
          navigate('/meus-kits');
          return;
        }
      }

      if (!isMod) {
        // "?" → Ajuda e reiniciar tour se disponível
        if (e.key === '?' && !isInput) {
          e.preventDefault();
          if (onboarding) {
            onboarding.restartTour();
          }
          return;
        }
        return;
      }

      // Ctrl/Cmd + K → Toggle search palette (works even inside inputs)
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        const nextState = !searchOpen;
        setOpenSearch(nextState);
        if (nextState) handlers?.onSearchFocus?.();
        return;
      }

      // Ctrl/Cmd + J → Open Flow (no conflict with browser shortcuts)
      if (e.key === 'j' && !isInput) {
        e.preventDefault();
        openOracle();
        return;
      }

      // Ctrl/Cmd + Shift + N → New quote (Shift avoids browser new-window)
      if (e.key === 'N' && e.shiftKey && !isInput) {
        e.preventDefault();
        navigate('/orcamentos/novo');
        return;
      }

      // Ctrl/Cmd + Shift + C → Open cart
      if ((e.key === 'C' || e.key === 'c') && e.shiftKey && !isInput) {
        e.preventDefault();
        handlers?.onToggleCart?.();
        return;
      }
    },
    [navigate, openOracle, handlers, searchOpen, setOpenSearch],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
