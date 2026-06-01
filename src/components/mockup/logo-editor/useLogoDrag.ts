import { useRef, useCallback } from 'react';
import { clamp } from './logoTechniqueFilters';

export function useLogoDrag(
  containerRef: React.RefObject<HTMLElement | null>,
  positionX: number,
  positionY: number,
  onPositionChange: (x: number, y: number) => void,
) {
  const draggingRef = useRef<{
    startClientX: number;
    startClientY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  const rafRef = useRef<number | null>(null);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const container = containerRef.current;
      const drag = draggingRef.current;
      if (!container || !drag) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const dx = e.clientX - drag.startClientX;
        const dy = e.clientY - drag.startClientY;

        const nextX = drag.startPosX + (dx / rect.width) * 100;
        const nextY = drag.startPosY + (dy / rect.height) * 100;

        onPositionChange(Math.round(clamp(nextX, 5, 95)), Math.round(clamp(nextY, 5, 95)));
      });
    },
    [onPositionChange, containerRef],
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      draggingRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPosX: positionX,
        startPosY: positionY,
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp, { once: true });
    },
    [positionX, positionY, handlePointerMove, handlePointerUp],
  );

  return { handlePointerDown };
}
