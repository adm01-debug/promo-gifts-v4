import { useEffect, useRef } from 'react';
import { NavigationType, useLocation, useNavigationType } from 'react-router-dom';
import { forceReleaseScrollLock } from '@/lib/dom/scroll-lock';

/**
 * RouteScrollReset
 * -----------------
 * Em navegacoes SPA (PUSH/REPLACE), rola a window suavemente ate o topo,
 * para que o conteudo da nova rota seja exibido a partir do inicio.
 *
 * Regras:
 * - POP (back/forward) preserva o scroll do navegador.
 * - Se a URL contem hash ancora (#id), respeita o destino e nao forca topo.
 * - Honra `prefers-reduced-motion` (fallback para `behavior: "auto"`).
 * - Skip no primeiro mount (evita interferir em deep-links com ancora).
 *
 * BUG FIX: A cada mudanca de rota, libera proativamente qualquer scroll-lock
 * residual do Radix UI (pointer-events: none preso em <html>/<body>). Isso
 * previne o cenario em que um Dialog/Dropdown fecha com race condition e
 * deixa a UI completamente nao-clicavel ate o watchdog de 300ms agir.
 * releaseScrollLockIfIdle() e no-op se houver overlay legitimo aberto.
 */
export function RouteScrollReset() {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType();
  const isFirstMount = useRef(true);

  useEffect(() => {
    // Libera scroll-lock residual do Radix em toda troca de rota.
    forceReleaseScrollLock();

    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (navType === NavigationType.Pop) return;
    if (hash) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
  }, [pathname, hash, navType]);

  return null;
}

export default RouteScrollReset;
