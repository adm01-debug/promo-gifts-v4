import { useState, useEffect, forwardRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ArrowUp } from 'lucide-react';
import { useAriaLive } from '@/components/a11y';

interface ScrollToTopButtonProps {
  threshold?: number;
  className?: string;
  /** Offset from bottom (default 6) */
  bottomOffset?: number | string;
}

export const ScrollToTopButton = forwardRef<HTMLButtonElement, ScrollToTopButtonProps>(
  function ScrollToTopButton({ threshold = 300, className, bottomOffset }, ref) {
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
          'fixed right-6 z-[60] rounded-full p-3 transition-all duration-300',
          'bg-primary text-primary-foreground shadow-lg',
          'hover:scale-105 hover:shadow-xl active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isVisible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-2 scale-90 opacity-0',
          className,
        )}
        style={{ 
          bottom: bottomOffset ? (typeof bottomOffset === 'number' ? `${bottomOffset}px` : bottomOffset) : '1.5rem' 
        }}
        onClick={handleScrollToTop}
        aria-label="Voltar ao topo da página"
        aria-hidden={!isVisible}
        tabIndex={isVisible ? 0 : -1}
        aria-keyshortcuts="Home"
        title="Voltar ao topo (Enter ou Espaço)"
      >
        <ArrowUp className="h-5 w-5" aria-hidden />
      </motion.button>
    );
  }
);
