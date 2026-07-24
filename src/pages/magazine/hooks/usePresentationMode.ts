/**
 * usePresentationMode — auto-advance de páginas com pausa/play/velocidade.
 *  - Toggle via `active`
 *  - Reinicia timer sempre que `currentIndex` muda manualmente
 *  - Pausa quando a aba fica escondida (visibilitychange)
 *  - Loop opcional (default: para no final)
 *  - Barra de progresso do intervalo via `progress` (0..1)
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  currentIndex: number;
  total: number;
  onAdvance: () => void;
  /** Intervalo em ms (default 5000). */
  intervalMs?: number;
  /** Volta para o começo ao atingir o fim (default true). */
  loop?: boolean;
}

export function usePresentationMode({
  currentIndex,
  total,
  onAdvance,
  intervalMs = 5000,
  loop = true,
}: Options) {
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const pausedByHidden = useRef(false);

  const stopTimers = useCallback(() => {
    // eslint-disable-next-line eqeqeq, no-eq-null -- checagem intencional de null/undefined
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line eqeqeq, no-eq-null -- checagem intencional de null/undefined
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    rafRef.current = null;
    timeoutRef.current = null;
  }, []);

  const start = useCallback(() => {
    stopTimers();
    startedAt.current = performance.now();
    setProgress(0);

    const tick = () => {
      const elapsed = performance.now() - startedAt.current;
      setProgress(Math.min(elapsed / intervalMs, 1));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    timeoutRef.current = window.setTimeout(() => {
      if (currentIndex >= total - 1) {
        if (loop) onAdvance(); // caller decide se loop; aqui só avança e caller faz go(0)
        else setActive(false);
      } else {
        onAdvance();
      }
    }, intervalMs);
  }, [currentIndex, intervalMs, loop, onAdvance, stopTimers, total]);

  // (Re)inicia o ciclo sempre que ativar OU o currentIndex mudar
  useEffect(() => {
    if (!active || total <= 1) {
      stopTimers();
      setProgress(0);
      return;
    }
    start();
    return stopTimers;
  }, [active, currentIndex, total, start, stopTimers]);

  // Pausa quando aba oculta
  useEffect(() => {
    if (!active) return;
    const onVis = () => {
      if (document.hidden) {
        pausedByHidden.current = true;
        stopTimers();
      } else if (pausedByHidden.current) {
        pausedByHidden.current = false;
        start();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [active, start, stopTimers]);

  const toggle = useCallback(() => setActive((v) => !v), []);
  const stop = useCallback(() => setActive(false), []);

  return { active, toggle, stop, progress };
}
