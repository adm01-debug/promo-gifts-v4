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
        // no default
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, goToPrevious, goToNext, handleZoomIn, handleZoomOut, handleRotate, resetView]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!isFullscreen) return;
      e.preventDefault();
      if (e.deltaY < 0) handleZoomIn();
      else handleZoomOut();
    },
    [isFullscreen, handleZoomIn, handleZoomOut],
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
