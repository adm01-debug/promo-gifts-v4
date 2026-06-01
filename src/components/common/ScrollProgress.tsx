import { useState, useEffect, forwardRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ArrowUp } from 'lucide-react';
import { useAriaLive } from '@/components/a11y';

interface ScrollProgressProps {
  className?: string;
  color?: 'primary' | 'orange' | 'success';
  height?: number;
  position?: 'top' | 'bottom';
}

/**
 * ScrollProgressIndicator - Barra de progresso de scroll (AN-12)
 */
export function ScrollProgressIndicator({
  className,
  color = 'primary',
  height = 3,
  position = 'top',
}: ScrollProgressProps) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const colorClasses = {
    primary: 'bg-primary',
    orange: 'bg-brand-primary',
    success: 'bg-success',
  };

  return (
    <motion.div
      className={cn(
        'pointer-events-none fixed left-0 right-0 z-50 origin-left',
        position === 'top' ? 'top-0' : 'bottom-0',
        colorClasses[color],
        className,
      )}
      style={{
        scaleX,
        height: `${height}px`,
      }}
      role="progressbar"
      aria-label="Progresso de rolagem da página"
      aria-valuemin={0}
      aria-valuemax={100}
    />
  );
}

/**
 * ScrollToTop - Botão para voltar ao topo
 */
export const ScrollToTopButton = forwardRef<
  HTMLButtonElement,
  { threshold?: number; className?: string }
>(function ScrollToTopButton({ threshold = 300, className }, ref) {
  const [isVisible, setIsVisible] = useState(false);
  const { announceStatus } = useAriaLive();

  useEffect(() => {
    // Após a correção do `position: sticky` do Header, o scroll vertical
    // é sempre da `window`. Listener simples e confiável.
    const handleScroll = () => {
      setIsVisible(window.scrollY > threshold);
    };

    handleScroll(); // estado inicial (caso já esteja rolado)
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  const handleScrollToTop = () => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReduced ? 'auto' : 'smooth',
    });

    // A11y: anuncia imediatamente o início da ação para leitores de tela
    // (region polite — não interrompe leitura em curso). WCAG 4.1.3.
    announceStatus('Voltando ao topo da página');

    // A11y: como o botão desaparece ao chegar no topo (perdendo o foco no
    // void), movemos o foco para o início lógico da página (`<main>` ou o
    // primeiro heading). Isso mantém usuários de teclado/leitor de tela
    // ancorados no novo contexto e dispara o anel de focus-visible no alvo.
    const moveFocusToTop = () => {
      const target =
        (document.getElementById('main-content') as HTMLElement | null) ??
        (document.querySelector('main') as HTMLElement | null) ??
        (document.querySelector('h1') as HTMLElement | null);
      if (!target) {
        // Mesmo sem alvo, confirma o término da mudança de contexto.
        announceStatus('Topo da página.');
        return;
      }
      const hadTabIndex = target.hasAttribute('tabindex');
      if (!hadTabIndex) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      // Restaura tabindex original para não vazar nó focável extra.
      if (!hadTabIndex) {
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
      // Confirma chegada e nova localização do foco.
      announceStatus('Topo da página. Foco no conteúdo principal.');
    };
    // Aguarda o smooth scroll terminar antes de focar (evita "puxar" o
    // viewport de volta). Em reduced-motion, foca imediatamente.
    if (prefersReduced) {
      moveFocusToTop();
    } else {
      window.setTimeout(moveFocusToTop, 350);
    }
  };

  if (!isVisible) return null;

  return (
    <motion.button
      ref={ref}
      key="scroll-to-top"
      data-testid="scroll-to-top"
      type="button"
      className={cn(
        // z-30: abaixo do Header sticky (z-40), acima do conteúdo.
        'fixed bottom-20 right-4 z-30 rounded-full p-3 lg:bottom-6 lg:right-6',
        'bg-primary text-primary-foreground shadow-lg',
        'hover:scale-105 hover:shadow-xl active:scale-95',
        'transition-transform duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleScrollToTop}
      aria-label="Voltar ao topo da página"
      aria-keyshortcuts="Home"
      title="Voltar ao topo (Enter ou Espaço)"
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </motion.button>
  );
});
export default ScrollProgressIndicator;
