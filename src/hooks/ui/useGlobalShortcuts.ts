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
 * BUG-9 FIX: Ctrl+Shift+C agora abre o carrinho via onToggleCart (passado por MainLayout).
 *   Alt+O no CartHeaderButton foi removido — conflitava com Alt+O=Orçamentos do Sidebar.
 */
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOracleVoiceBridge } from '@/stores/oracleVoiceBridge';
import { useSearchStore } from '@/stores/useSearchStore';
import { useOptionalOnboardingContext } from '@/contexts/OnboardingContext';

interface ShortcutHandlers {
  onSearchFocus?: () => void;
  onToggleCart?: () => void;
}

export function useGlobalShortcuts(handlers?: ShortcutHandlers) {
  const navigate = useNavigate();
  const openOracle = useOracleVoiceBridge((s) => s.openOracle);
  const { open: searchOpen, setOpen: setOpenSearch } = useSearchStore();
  // BUG-25 + ESLint fix: substituído padrão try/catch (que violava rules-of-hooks)
  // por useOptionalOnboardingContext que retorna null quando o provider não existe.
  const onboarding = useOptionalOnboardingContext();

  /**
   * BUG-25 FIX: mover lastGAt de escopo de módulo para useRef interno.
   *
   * PROBLEMA ORIGINAL: `let lastGAt = 0` em escopo de módulo (singleton global)
   * era compartilhado entre todas as instâncias do hook e persistia entre testes.
   * Um "G" pressionado em uma instância poderia acionar "G→K" em outra, e entre
   * suites de teste o estado não era resetado (flaky tests).
   *
   * SOLUÇÃO: useRef isolado por instância — cada mount tem seu próprio contador.
   */
  const lastGAtRef = useRef(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // G then K (within 800ms) → open kit library — no modifier, ignored in inputs
      if (!isMod && !e.altKey && !e.shiftKey && !isInput) {
        if (e.key === 'g' || e.key === 'G') {
          lastGAtRef.current = Date.now(); // BUG-25 FIX: ref por instância
          return;
        }
        if ((e.key === 'k' || e.key === 'K') && Date.now() - lastGAtRef.current < 800) {
          e.preventDefault();
          lastGAtRef.current = 0; // BUG-25 FIX: reset do ref por instância
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
      }
    },
    [navigate, openOracle, handlers, searchOpen, setOpenSearch, onboarding],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
