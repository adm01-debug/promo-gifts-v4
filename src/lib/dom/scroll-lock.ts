/**
 * Radix UI (react-remove-scroll / DismissableLayer) locks page scroll and sets
 * `pointer-events: none` on <html>/<body> while a modal overlay (Dialog,
 * DropdownMenu, Select, AlertDialog, Drawer…) is open. A well-known race can
 * leave those styles stuck after the overlay closes/unmounts, which makes the
 * entire UI unclickable — the user clicks buttons and nothing happens.
 *
 * These helpers detect whether an overlay is genuinely open and release a
 * stuck lock when it is not. Shared by the global watchdog hook and by the
 * per-primitive `onCloseAutoFocus` handlers so the cleanup logic never drifts.
 */

const OPEN_OVERLAY_SELECTORS = [
  '[data-state="open"][role="dialog"]',
  '[data-state="open"][role="alertdialog"]',
  '[data-state="open"][role="menu"]',
  '[data-state="open"][role="listbox"]',
  // Radix popper-based content (dropdown/select/popover/menubar) mounts this
  // wrapper while open and removes it on close.
  '[data-radix-popper-content-wrapper]',
  // Vaul drawer (mobile sheets)
  '[vaul-drawer][data-state="open"]',
];

/** True when a modal overlay is genuinely open and the lock is legitimate. */
export function hasOpenOverlay(): boolean {
  if (typeof document === 'undefined') return false;
  return OPEN_OVERLAY_SELECTORS.some((sel) => document.querySelector(sel) !== null);
}

/**
 * Strip every scroll-lock side effect from <html> and <body>, including the
 * inline `pointer-events: none` that blocks all interaction. Unconditional —
 * callers must ensure no overlay is open (see {@link releaseScrollLockIfIdle}).
 */
export function releaseScrollLock(): void {
  if (typeof document === 'undefined') return;

  for (const el of [document.documentElement, document.body]) {
    el.removeAttribute('data-scroll-locked');

    const s = el.style;
    if (s.overflow === 'hidden') s.overflow = '';
    if (s.overflowY === 'hidden') s.overflowY = '';
    if (s.position === 'fixed') s.position = '';
    if (s.marginRight) s.marginRight = '';
    if (s.paddingRight) s.paddingRight = '';
    if (s.touchAction === 'none') s.touchAction = '';
    if (s.pointerEvents === 'none') s.pointerEvents = '';
    if (s.top && s.position !== 'fixed') s.top = '';
  }

  if (document.body.style.width === '100%') document.body.style.width = '';

  document.body.classList.forEach((cls) => {
    if (cls.startsWith('block-interactivity-')) {
      document.body.classList.remove(cls);
    }
  });
}

/** Release the lock only when no overlay is genuinely open. */
export function releaseScrollLockIfIdle(): void {
  // If we have an open overlay, we keep the lock.
  if (hasOpenOverlay()) return;
  
  // Otherwise, release everything.
  releaseScrollLock();
}

/** 
 * Force release during navigation, with a small delay to allow the new 
 * page to mount and Radix components from the old page to unmount.
 */
export function forceReleaseScrollLock(): void {
  // We use a small timeout because navigation unmounts are often 
  // processed after the URL change.
  setTimeout(() => {
    // If a new modal was opened immediately on the new page, respect it.
    if (hasOpenOverlay()) return;
    
    // forceRootInteractive clears everything AND sets pointer-events: auto 
    // as a fallback if something still looks stuck.
    forceRootInteractive();
  }, 60);
}



/**
 * True when <body> is currently inert via a stuck `pointer-events: none`
 * (inline) while no overlay justifies it.
 */
export function isBodyStuckInert(): boolean {
  if (typeof document === 'undefined') return false;
  return document.body.style.pointerEvents === 'none' && !hasOpenOverlay();
}

/** Root elements that, if made non-interactive, freeze the whole app. */
function rootElements(): HTMLElement[] {
  const root = document.getElementById('root');
  return [document.documentElement, document.body, root].filter(
    (el): el is HTMLElement => el !== null,
  );
}

/**
 * True when <html>, <body> or #root has a *computed* `pointer-events: none`
 * (inline OR via a stylesheet) while no overlay justifies it — i.e. the entire
 * app is unclickable. Broader than {@link isBodyStuckInert}, which only sees
 * the inline value on <body>.
 */
export function isRootInert(): boolean {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return false;
  if (hasOpenOverlay()) return false;
  return rootElements().some((el) => getComputedStyle(el).pointerEvents === 'none');
}

/**
 * Force <html>/<body>/#root back to interactive by setting an inline
 * `pointer-events: auto` (which beats a stuck inline `none` and most
 * stylesheet rules), and clear any residual scroll-lock side effects.
 * Unconditional — callers must ensure no overlay is open.
 */
export function forceRootInteractive(): void {
  if (typeof document === 'undefined') return;
  releaseScrollLock();
  for (const el of rootElements()) {
    if (typeof getComputedStyle !== 'undefined' && getComputedStyle(el).pointerEvents === 'none') {
      el.style.pointerEvents = 'auto';
    }
  }
}
