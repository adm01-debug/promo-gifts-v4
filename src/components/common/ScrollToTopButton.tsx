
import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollToTopButtonProps {
  /** Opcional: container que está sendo scrollado. Se omitido, usa a window. */
  containerRef?: React.RefObject<HTMLElement>;
  /** Threshold de scroll para mostrar o botão (default: 400). */
  threshold?: number;
  className?: string;
}

export function ScrollToTopButton({ 
  containerRef, 
  threshold = 400,
  className 
}: ScrollToTopButtonProps) {
  const [show, setShow] = useState(false);

  const handleScroll = useCallback(() => {
    const scrollTop = containerRef?.current 
      ? containerRef.current.scrollTop 
      : window.scrollY;
    
    setShow(scrollTop > threshold);
  }, [containerRef, threshold]);

  useEffect(() => {
    const target = containerRef?.current || window;
    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [containerRef, handleScroll]);

  const scrollToTop = () => {
    const target = containerRef?.current || window;
    target.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          onClick={scrollToTop}
          className={cn(
            "fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-brand-primary text-white shadow-lg transition-all hover:bg-brand-primary/90 active:scale-95 sm:bottom-8 sm:right-8",
            className
          )}
          aria-label="Voltar ao topo"
          title="Voltar ao topo"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

