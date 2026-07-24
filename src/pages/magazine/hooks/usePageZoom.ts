/**
 * usePageZoom — zoom com duplo-clique/duplo-toque e pan por arrastar.
 * Zoom binário 1x ↔ 2x (mantém simplicidade e evita jitter em pinch nativo).
 * Reset automático ao trocar de página.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface State {
  scale: 1 | 2;
  tx: number;
  ty: number;
}

const INITIAL: State = { scale: 1, tx: 0, ty: 0 };

export function usePageZoom(pageKey: number | string) {
  const [state, setState] = useState<State>(INITIAL);
  const dragging = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef<number>(0);

  useEffect(() => {
    setState(INITIAL);
  }, [pageKey]);

  const toggleZoom = useCallback((clientX?: number, clientY?: number, rect?: DOMRect) => {
    setState((s) => {
      if (s.scale === 2) return INITIAL;
      // centraliza no ponto clicado quando possível
      // eslint-disable-next-line eqeqeq, no-eq-null -- checagem intencional de null/undefined
      if (clientX != null && clientY != null && rect) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return { scale: 2, tx: (cx - clientX), ty: (cy - clientY) };
      }
      return { scale: 2, tx: 0, ty: 0 };
    });
  }, []);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      toggleZoom(e.clientX, e.clientY, rect);
    },
    [toggleZoom],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      // Detecta double-tap manualmente
      const now = Date.now();
      if (now - lastTap.current < 300 && e.touches.length === 1) {
        const t = e.touches[0];
        const rect = e.currentTarget.getBoundingClientRect();
        toggleZoom(t.clientX, t.clientY, rect);
      }
      lastTap.current = now;

      if (state.scale === 2 && e.touches.length === 1) {
        const t = e.touches[0];
        dragging.current = { x: t.clientX, y: t.clientY, tx: state.tx, ty: state.ty };
      }
    },
    [state, toggleZoom],
  );

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragging.current || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - dragging.current.x;
    const dy = t.clientY - dragging.current.y;
    setState((s) => ({ ...s, tx: dragging.current!.tx + dx, ty: dragging.current!.ty + dy }));
  }, []);

  const onTouchEnd = useCallback(() => {
    dragging.current = null;
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (state.scale !== 2) return;
      dragging.current = { x: e.clientX, y: e.clientY, tx: state.tx, ty: state.ty };
    },
    [state],
  );

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    setState((s) => ({ ...s, tx: dragging.current!.tx + dx, ty: dragging.current!.ty + dy }));
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = null;
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return {
    state,
    reset,
    toggleZoom: () => toggleZoom(),
    handlers: {
      onDoubleClick,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave: onMouseUp,
    },
  };
}
