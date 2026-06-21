import { useState, useEffect, useCallback } from 'react';

interface UseScrollOptions {
  threshold?: number;
  throttleMs?: number;
}

/**
 * useScroll - Hook para detectar scroll da página
 * Retorna informações sobre o scroll atual
 */
export function useScroll(options: UseScrollOptions = {}) {
  const { threshold = 10, throttleMs: _throttleMs = 16 } = options;

  const [scrollState, setScrollState] = useState({
    scrollY: 0,
    scrollX: 0,
    isScrolled: false,
    direction: 'none' as 'down' | 'none' | 'up',
    isAtTop: true,
    isAtBottom: false,
  });

  const [lastScrollY, setLastScrollY] = useState(0);

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    const currentScrollX = window.scrollX;
    const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;

    const direction =
      currentScrollY > lastScrollY ? 'down' : currentScrollY < lastScrollY ? 'up' : 'none';

    setScrollState({
      scrollY: currentScrollY,
      scrollX: currentScrollX,
      isScrolled: currentScrollY > threshold,
      direction,
      isAtTop: currentScrollY <= threshold,
      isAtBottom: currentScrollY >= maxScrollY - threshold,
    });

    setLastScrollY(currentScrollY);
  }, [lastScrollY, threshold]);

  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    // Initial check
    handleScroll();

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [handleScroll]);

  return scrollState;
}

/**
 * useScrollDirection - Hook simplificado apenas para direção
 */
export function useScrollDirection(threshold = 10) {
  const [scrollDirection, setScrollDirection] = useState<'down' | 'up' | null>(null);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const updateScrollDirection = () => {
      const scrollY = window.scrollY;

      if (Math.abs(scrollY - lastScrollY) < threshold) {
        return;
      }

      setScrollDirection(scrollY > lastScrollY ? 'down' : 'up');
      setLastScrollY(scrollY > 0 ? scrollY : 0);
    };

    window.addEventListener('scroll', updateScrollDirection, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollDirection);
  }, [lastScrollY, threshold]);

  return scrollDirection;
}

/**
 * useIsScrolled - Hook simples para verificar se scrollou
 */
export function useIsScrolled(threshold = 10) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > threshold);
    };

    // Check initial state
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return isScrolled;
}

/**
 * useScrollProgress - Hook para progresso de scroll (0-100)
 */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
      const newProgress = maxScrollY > 0 ? (scrollY / maxScrollY) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, newProgress)));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return progress;
}

export default useScroll;
