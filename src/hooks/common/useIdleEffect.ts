/**
 * useIdleEffect — Executa um efeito durante idle time do browser.
 *
 * Usa requestIdleCallback quando disponível (Chrome/Edge/Firefox modernos),
 * fallback para setTimeout(fn, delay) em Safari.
 *
 * Ideal para operações non-critical: analytics, telemetria, prefetch, etc.
 * Não bloqueia o thread principal durante carregamento de página.
 *
 * @param fn - Função a executar durante idle time
 * @param deps - Dependências do effect (mesmo comportamento que useEffect)
 * @param options - Opções do requestIdleCallback (timeout em ms)
 */
import { useEffect } from 'react';

interface IdleOptions {
  timeout?: number; // max wait antes de forçar execução (ms). Default: 3000
  delay?: number; // delay mínimo antes de agendar (ms). Default: 0
}

export function useIdleEffect(
  fn: () => (() => void) | undefined,
  deps: React.DependencyList,
  { timeout = 3000, delay = 0 }: IdleOptions = {},
): void {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let idleId: number | undefined;
    // BUG-G FIX (2026-06-15): separate variables so the delay timer and the
    // fallback schedule timer are both properly cancelled on unmount.
    // Before: timerId was overwritten inside schedule() losing the delay timer ref.
    let delayTimerId: ReturnType<typeof setTimeout> | undefined;
    let scheduleTimerId: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(
          () => {
            cleanup = fn();
          },
          { timeout },
        );
      } else {
        scheduleTimerId = setTimeout(
          () => {
            cleanup = fn();
          },
          Math.max(timeout / 2, 100),
        );
      }
    };

    if (delay > 0) {
      delayTimerId = setTimeout(schedule, delay);
    } else {
      schedule();
    }

    return () => {
      if (idleId !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (delayTimerId !== undefined) clearTimeout(delayTimerId);
      if (scheduleTimerId !== undefined) clearTimeout(scheduleTimerId);
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
