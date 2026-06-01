/**
 * Scroll-lock fix v11 — global watchdog against Radix's stuck body lock.
 */
import { useEffect } from 'react';
import { releaseScrollLockIfIdle, isRootInert, forceRootInteractive } from '@/lib/dom/scroll-lock';

export function useScrollLockFix() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let scheduled = false;

    const scheduleCleanup = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        if (isRootInert()) {
          console.warn('[ScrollLockFix] Detected stuck inert root, forcing recovery');
          forceRootInteractive();
        } else {
          releaseScrollLockIfIdle();
        }
      });
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          scheduleCleanup();
          return;
        }

        const attr = mutation.attributeName;
        if (attr === 'data-state') {
          const target = mutation.target as HTMLElement;
          if (target.getAttribute('data-state') === 'closed') {
            scheduleCleanup();
            return;
          }
        } else if (attr === 'style' || attr === 'class') {
          scheduleCleanup();
          return;
        }
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    const selfHeal = () => {
      if (isRootInert()) {
        console.warn('[ScrollLockFix] Interactive click blocked by inert root — healing');
        forceRootInteractive();
      }
    };
    window.addEventListener('pointerdown', selfHeal, { capture: true });

    forceRootInteractive();

    return () => {
      observer.disconnect();
      window.removeEventListener('pointerdown', selfHeal, { capture: true });
    };
  }, []);
}
