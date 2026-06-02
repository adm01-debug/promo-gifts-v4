import { useState, useEffect, useRef, forwardRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ArrowUp } from 'lucide-react';
import { useAriaLive } from '@/components/a11y';

interface ScrollProgressProps {
  className?: string;
  color?: 'primary' | 'orange' | 'success';
  height?: number;
  position?: 'top' | 'bottom';
}

export function ScrollProgressIndicator({
  className,
  color = 'primary',
  height = 3,
  position = 'top',
}: ScrollProgressProps) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    const update = () => {
      const el = document.documentElement;
      const scrollTop = el.scrollTop || document.body.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${progress})`;
      }
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const colorClasses = {
    primary: 'bg-primary',
    orange: 'bg-brand-primary',
    success: 'bg-success',
  };

  return (
    <div
      ref={barRef}
      className={cn(
        'pointer-events-none fixed left-0 right-0 z-50 origin-left will-change-transform',
        position === 'top' ? 'top-0' : 'bottom-0',
        colorClasses[color],
        className,
      )}
      style={{ height: `${height}px`, transform: 'scaleX(0)' }}
      role="progressbar"
      aria-label="Progresso de rolagem da página"
      aria-valuemin={0}
      aria-valuemax={100}
    />
  );
}

export const ScrollToTopButton = forwardRef<
  HTMLButtonElement,
  { threshold?: number; className?: string }
>(function ScrollToTopButton({ threshold = 300, className }, ref) {
  const [isVisible, setIsVisible] = useState(false);
  const { announceStatus } = useAriaLive();

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > threshold);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  const handleScrollToTop = useCallback(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
    announceStatus('Voltando ao topo da página');
    const moveFocusToTop = () => {
      const target =
        (document.getElementById('main-content') as HTMLElement | null) ??
        (document.querySelector('main') as HTMLElement | null) ??
        (document.querySelector('h1') as HTMLElement | null);
      if (!target) {
        announceStatus('Topo da página.');
        return;
      }
      const hadTabIndex = target.hasAttribute('tabindex');
      if (!hadTabIndex) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      if (!hadTabIndex) {
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
      announceStatus('Topo da página. Foco no conteúdo principal.');
    };
    if (prefersReduced) {
      moveFocusToTop();
    } else {
      window.setTimeout(moveFocusToTop, 350);
    }
  }, [announceStatus]);

  return (
    <motion.button
      ref={ref}
      layout
      data-testid="scroll-to-top"
      type="button"
      className={cn(
        'fixed bottom-6 right-6 z-[60] rounded-full p-3 transition-all duration-300',
        'bg-primary text-primary-foreground shadow-lg',
        'hover:scale-105 hover:shadow-xl active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isVisible
          ? 'translate-y-0 scale-100 opacity-100'
          : 'pointer-events-none translate-y-2 scale-90 opacity-0',
        className,
      )}
      onClick={handleScrollToTop}
      aria-label="Voltar ao topo da página"
      aria-hidden={!isVisible}
      tabIndex={isVisible ? 0 : -1}
      aria-keyshortcuts="Home"
      title="Voltar ao topo (Enter ou Espaço)"
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </button>
  );
});
export default ScrollProgressIndicator;
