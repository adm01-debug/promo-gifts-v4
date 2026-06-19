import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const SCROLL_COLOR_CLASSES = {
  primary: 'bg-primary',
  orange: 'bg-brand-primary',
  success: 'bg-success',
} as const;

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

  return (
    <div
      ref={barRef}
      className={cn(
        'pointer-events-none fixed left-0 right-0 z-50 origin-left will-change-transform',
        position === 'top' ? 'top-0' : 'bottom-0',
        SCROLL_COLOR_CLASSES[color],
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

export default ScrollProgressIndicator;
