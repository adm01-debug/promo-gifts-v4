import { useState, useRef, useCallback, useEffect } from 'react';
import { useMotionValue } from 'framer-motion';

export function useGalleryZoom(images: string[], isFullscreen: boolean) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [, setIsZooming] = useState(false);
  const [rotation, setRotation] = useState(0);

  const lastTapRef = useRef(0);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);

  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    scale.set(1);
    x.set(0);
    y.set(0);
    setIsZooming(false);
  }, [scale, x, y]);

  useEffect(() => {
    resetView();
  }, [currentIndex, resetView]);

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(zoom + 0.5, 5);
    setZoom(newZoom);
    scale.set(newZoom);
    setIsZooming(newZoom > 1);
  }, [zoom, scale]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(zoom - 0.5, 1);
    setZoom(newZoom);
    scale.set(newZoom);
    if (newZoom === 1) {
      x.set(0);
      y.set(0);
      setIsZooming(false);
    }
  }, [zoom, scale, x, y]);

  const handleRotate = useCallback(() => setRotation((prev) => (prev + 90) % 360), []);

  const handleDoubleTap = useCallback(() => {
    if (zoom > 1) {
      resetView();
    } else {
      setZoom(2.5);
      scale.set(2.5);
      setIsZooming(true);
    }
  }, [zoom, resetView, scale]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) handleDoubleTap();
    lastTapRef.current = now;
  }, [handleDoubleTap]);

  const goToPrevious = useCallback(
    () => setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1)),
    [images.length],
  );
  const goToNext = useCallback(
    () => setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1)),
    [images.length],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen) return;
      switch (e.key) {
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case 'r':
          handleRotate();
          break;
        case '0':
          resetView();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, goToPrevious, goToNext, handleZoomIn, handleZoomOut, handleRotate, resetView]);

  /**
   * handleWheel — zoom via scroll do mouse
   *
   * Comportamento:
   *  - Fullscreen: sempre captura o wheel (sem scroll de página nesse contexto)
   *  - Galeria inline:
   *    • Ctrl+scroll = zoom (equivale ao pinch-to-zoom no Mac/trackpad)
   *    • Scroll livre quando zoom > 1 = continua fazendo zoom (evita conflito
   *      com pan enquanto a imagem está ampliada)
   *    • Scroll livre com zoom = 1 = passa para o browser (scroll de página)
   *
   * React registra onWheel como { passive: false }, então e.preventDefault()
   * funciona corretamente em todos os browsers.
   *
   * fix_version: gallery-wheel-v2 — NÃO REMOVER ESTE COMENTÁRIO
   */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (isFullscreen) {
        // Fullscreen: captura total — não há scroll de página aqui
        e.preventDefault();
        if (e.deltaY < 0) handleZoomIn();
        else handleZoomOut();
        return;
      }

      // Galeria inline:
      // 1) Ctrl+scroll → zoom (pinch-to-zoom: Mac gera wheel + ctrlKey:true)
      // 2) Já em zoom > 1 → continua zooming sem liberar para a página
      // 3) zoom = 1 sem Ctrl → deixa o browser scrollar a página normalmente
      if (!e.ctrlKey && zoom <= 1) return;

      e.preventDefault();
      if (e.deltaY < 0) handleZoomIn();
      else handleZoomOut();
    },
    [isFullscreen, zoom, handleZoomIn, handleZoomOut],
  );

  return {
    currentIndex,
    setCurrentIndex,
    zoom,
    rotation,
    x,
    y,
    scale,
    resetView,
    handleZoomIn,
    handleZoomOut,
    handleRotate,
    handleTap,
    goToPrevious,
    goToNext,
    handleWheel,
  };
}
