import { useEffect, useState } from 'react';
import { hasOpenOverlay, isRootInert, forceRootInteractive } from '@/lib/dom/scroll-lock';

/**
 * RootInteractivityGuard - last-resort watchdog that guarantees the app never
 * gets stuck completely unclickable.
 *
 * Mounted at the very top of the tree (App.tsx, OUTSIDE MainLayout) so it runs
 * on EVERY route - including ones that don't render MainLayout. It recovers
 * from two whole classes of "the whole UI is frozen to clicks" bugs and logs a
 * precise diagnostic naming the culprit each time it acts:
 *
 *  A) A stuck `pointer-events: none` on <html>/<body>/#root (Radix's
 *     react-remove-scroll race, or any other code that injects it) while no
 *     modal is genuinely open -> restored to interactive.
 *  B) An invisible full-viewport "ghost" element sitting on top and swallowing
 *     every click (orphan backdrop, stray fixed layer, a third-party toolbar
 *     overlay, etc.) -> its `pointer-events` is disabled so clicks fall through.
 *
 * Conservative by design: never touches the document root elements as "ghosts",
 * never neutralizes an element that belongs to a legitimately-open overlay, and
 * only treats an element as a ghost when it covers the viewport AND is visually
 * empty/transparent.
 *
 * BUG FIX: intervalo reduzido de 1500ms -> 300ms para encurtar a janela de
 * tempo em que a UI pode ficar travada entre dois ciclos do watchdog.
 * O overhead e negligivel (apenas getComputedStyle em 3 elementos por ciclo).
 * Boot-time timeouts tambem adensados: [0, 100, 300, 600, 1000].
 */

const COVERAGE = 0.9; // element must span >=90% of the viewport in both axes
const GHOST_MARK = 'data-interactivity-ghost';

function isElementVisiblyEmpty(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  if (parseFloat(style.opacity || '1') < 0.05) return true;
  if (style.visibility === 'hidden') return true;
  const bg = style.backgroundColor || '';
  const transparentBg = bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)' || bg === '';
  const hasText = (el.textContent || '').trim().length > 0;
  return transparentBg && !hasText;
}

function findGhostOverlay(): HTMLElement | null {
  if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') {
    return null;
  }
  const root = document.getElementById('root');
  const w = window.innerWidth;
  const h = window.innerHeight;
  const points: [number, number][] = [
    [w / 2, h / 2],
    [w * 0.25, h * 0.35],
    [w * 0.75, h * 0.65],
  ];

  let candidate: HTMLElement | null = null;
  for (const [x, y] of points) {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    if (candidate === null) candidate = el;
    else if (candidate !== el) return null;
  }
  if (!candidate) return null;

  if (candidate === document.body || candidate === document.documentElement || candidate === root) {
    return null;
  }
  if (
    candidate.closest(
      '[data-state="open"],[data-radix-popper-content-wrapper],[role="dialog"],[role="alertdialog"]',
    )
  ) {
    return null;
  }

  const rect = candidate.getBoundingClientRect();
  const coversViewport = rect.width >= w * COVERAGE && rect.height >= h * COVERAGE;
  if (!coversViewport) return null;
  if (!isElementVisiblyEmpty(candidate)) return null;

  return candidate;
}

function describe(el: Element | null): string {
  if (!el) return 'null';
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls =
    typeof el.className === 'string' && el.className
      ? `.${el.className.trim().split(/\s+/).slice(0, 4).join('.')}`
      : '';
  return `${tag}${id}${cls}`;
}

export function RootInteractivityGuard() {
  const [recoveries, setRecoveries] = useState(0);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let lastLog = '';
    const log = (reason: string, extra: Record<string, unknown>) => {
      const key = reason + JSON.stringify(extra);
      if (key === lastLog) return;
      lastLog = key;
      console.warn(`[InteractivityGuard] recovered: ${reason}`, extra);
      setRecoveries((n) => n + 1);
    };

    const snapshot = () => {
      const root = document.getElementById('root');
      const cs = (el: Element | null) =>
        el && typeof getComputedStyle !== 'undefined' ? getComputedStyle(el).pointerEvents : 'n/a';
      return {
        htmlPE: cs(document.documentElement),
        bodyPE: cs(document.body),
        rootPE: cs(root),
        openOverlay: hasOpenOverlay(),
      };
    };

    let pendingGhost: HTMLElement | null = null;

    const check = (allowGhost: boolean) => {
      if (isRootInert()) {
        const before = snapshot();
        forceRootInteractive();
        log('root pointer-events:none', before);
        return;
      }
      if (!allowGhost) return;
      const ghost = findGhostOverlay();
      if (ghost && ghost === pendingGhost) {
        ghost.style.pointerEvents = 'none';
        ghost.setAttribute(GHOST_MARK, 'true');
        pendingGhost = null;
        log('ghost overlay neutralized', {
          element: describe(ghost),
          outerHTML: ghost.outerHTML.slice(0, 300),
        });
      } else {
        pendingGhost = ghost;
      }
    };

    const onPointerDown = () => check(false);
    window.addEventListener('pointerdown', onPointerDown, { capture: true });

    const onVisibility = () => {
      if (document.visibilityState === 'visible') check(true);
    };
    document.addEventListener('visibilitychange', onVisibility);

    // BUG FIX: intervalo reduzido 1500ms -> 300ms. Boot-times adensados.
    const timeouts = [0, 100, 300, 600, 1000].map((d) => window.setTimeout(() => check(true), d));
    const interval = window.setInterval(() => check(true), 300);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
      timeouts.forEach((t) => window.clearTimeout(t));
      window.clearInterval(interval);
    };
  }, []);

  if (import.meta.env.DEV && recoveries > 0) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 8,
          left: 8,
          zIndex: 2147483647,
          pointerEvents: 'none',
          background: 'rgba(220,38,38,0.9)',
          color: 'white',
          font: '11px/1.4 monospace',
          padding: '4px 8px',
          borderRadius: 6,
        }}
      >
        InteractivityGuard agiu {recoveries}x - veja o console
      </div>
    );
  }

  return null;
}
