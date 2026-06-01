import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SectionTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface ProductSectionNavProps {
  tabs: SectionTab[];
  className?: string;
}

/**
 * Scroll-spy tab navigation for product detail sections.
 * Highlights the active section as user scrolls.
 */
export function ProductSectionNav({ tabs, className }: ProductSectionNavProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id || '');
  const navRef = useRef<HTMLDivElement>(null);
  const isClickScrolling = useRef(false);

  // Scroll-spy: observe which section is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (isClickScrolling.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0.1 },
    );

    tabs.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [tabs]);

  const handleClick = useCallback((id: string) => {
    setActiveId(id);
    isClickScrolling.current = true;

    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Reset flag after scroll animation
      setTimeout(() => {
        isClickScrolling.current = false;
      }, 800);
    }
  }, []);

  // Scroll active tab into view within the nav bar
  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector(`[data-tab="${activeId}"]`);
    if (activeBtn) {
      (activeBtn as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeId]);

  if (tabs.length < 2) return null;

  return (
    <div
      ref={navRef}
      className={cn(
        'scrollbar-hide sticky top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px))] z-40 flex gap-1 overflow-x-auto',
        'border-b border-border bg-background/95 backdrop-blur-md',
        '-mx-4 px-4 py-1.5 md:-mx-0 md:px-0',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeId === tab.id;
        return (
          <button
            key={tab.id}
            data-tab={tab.id}
            onClick={() => handleClick(tab.id)}
            className={cn(
              'relative shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
            )}
          >
            {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="section-nav-indicator"
                className="absolute inset-0 -z-10 rounded-full bg-secondary"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
