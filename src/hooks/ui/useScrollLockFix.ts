import { useEffect } from 'react';
import { releaseScrollLockIfIdle, isBodyStuckInert } from '@/lib/dom/scroll-lock';

/**
 * Scroll-lock fix v10 — global watchdog against Radix's stuck body lock.
 *
 * Radix (react-remove-scroll / DismissableLayer) sets `pointer-events: none`
 * and `overflow: hidden` on <html>/<body> while a modal overlay is open. A
 * known race can leave those styles stuck after the overlay closes, making the
 * whole UI unclickable. This hook recovers from every leak path:
 *
 *  1) MutationObserver on overlay `data-state` transitions (the normal close).
 *  2) MutationObserver on <html>/<body> `style`/`class` (catches the inline
 *     `pointer-events: none` injection even when no `data-state` change fires,
 *     e.g. when the overlay unmounts without transitioning to "closed").
 *  3) A capture-phase `pointerdown` self-heal: if the user clicks while <body>
 *     is stuck inert and no overlay is open, the lock is released synchronously
 *     so the very same interaction can land on its target.
 */
export function useScrollLockFix() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let scheduled = false;

    const scheduleCleanup = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        releaseScrollLockIfIdle();
      });
    };

    // 1 + 2) Watch overlay close transitions and direct style/class mutations
    //         on the root elements.
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
          // A root element gained/changed inline styles — re-check on the next
          // frame, by which point any genuinely-open overlay is mounted.
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

    // 3) Last-resort self-heal: if a click is attempted while the page is stuck
    //    inert, release the lock immediately so the click can reach its target.
    const selfHeal = () => {
      if (isBodyStuckInert()) releaseScrollLockIfIdle();
    };
    window.addEventListener('pointerdown', selfHeal, { capture: true });

    // One-time initial cleanup (e.g. after a hard reload mid-overlay).
    releaseScrollLockIfIdle();

    return () => {
      observer.disconnect();
      window.removeEventListener('pointerdown', selfHeal, { capture: true });
    };
  }, []);
}
