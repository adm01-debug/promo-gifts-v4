/**
 * usePrefetchOnHover — Helper genérico para prefetch de dados/rotas ao hover
 * ou foco, com debounce curto (evita fire em movimento rápido do mouse).
 *
 * Guardas:
 *   - Respeita `saveData` / conexões 2G-3G lentas (mesma heurística do
 *     RoutePrefetcher).
 *   - Executa `fn` uma única vez por instância (flag interna).
 *   - Cancela debounce no leave / blur.
 *
 * Uso:
 * ```tsx
 * const handlers = usePrefetchOnHover(() => prefetchProduct(id));
 * return <li {...handlers}>{...}</li>;
 * ```
 */
import { useCallback, useEffect, useRef } from 'react';

type ConnectionInfo = { saveData?: boolean; effectiveType?: string };
type NavigatorWithConnection = Navigator & { connection?: ConnectionInfo };

function shouldSkipPrefetch(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  const conn = (navigator as NavigatorWithConnection).connection;
  if (!conn) return false;
  return !!(conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g');
}

export interface PrefetchHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onTouchStart: () => void;
}

export function usePrefetchOnHover(
  fn: () => void | Promise<unknown>,
  { debounceMs = 120, enabled = true }: { debounceMs?: number; enabled?: boolean } = {},
): PrefetchHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback(() => {
    if (!enabled || firedRef.current) return;
    if (shouldSkipPrefetch()) return;
    cancel();
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      try {
        void fn();
      } catch {
        firedRef.current = false;
      }
    }, debounceMs);
  }, [fn, debounceMs, enabled, cancel]);

  const scheduleImmediate = useCallback(() => {
    if (!enabled || firedRef.current) return;
    if (shouldSkipPrefetch()) return;
    firedRef.current = true;
    try {
      void fn();
    } catch {
      firedRef.current = false;
    }
  }, [fn, enabled]);

  useEffect(() => cancel, [cancel]);

  return {
    onMouseEnter: schedule,
    onMouseLeave: cancel,
    onFocus: schedule,
    onBlur: cancel,
    // touch: sem debounce — usuário já expressou intenção clara
    onTouchStart: scheduleImmediate,
  };
}
