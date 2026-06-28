import { useEffect, type RefObject } from 'react';

/**
 * useHorizontalScroll
 *
 * Converte scroll vertical do mouse em scroll horizontal no elemento referenciado.
 *
 * Regras de não-interferência:
 *   - Se deltaX ≠ 0 → scroll horizontal nativo (trackpad 2 dedos) → não intercepta
 *   - Se shiftKey → comportamento padrão do browser para scroll horizontal → não intercepta
 *   - Se não há overflow horizontal real → não intercepta (página scrolla normalmente)
 *   - Normaliza deltaMode: 0=pixel, 1=linha(×16), 2=página(×400)
 *
 * Requer { passive: false } para poder chamar preventDefault().
 * O hook registra o listener diretamente no DOM (não via React sintético)
 * para garantir o passive:false independente da versão do React.
 *
 * fix_version: horizontal-scroll-hook-v1 — NÃO REMOVER ESTE COMENTÁRIO
 *
 * @param ref        Referência para o elemento scrollável
 * @param disabled   Desabilitar o hook condicionalmente
 * @param multiplier Multiplicador de velocidade (default 1.0)
 */
export function useHorizontalScroll(
  ref: RefObject<HTMLElement | null>,
  { disabled = false, multiplier = 1.0 }: { disabled?: boolean; multiplier?: number } = {},
) {
  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      // Scroll horizontal nativo (trackpad 2 dedos / shift+wheel padrão)
      if (e.deltaX !== 0 || e.shiftKey) return;

      // Só interceptar se há overflow horizontal real
      if (el.scrollWidth <= el.clientWidth) return;

      // Normalizar delta por deltaMode:
      //   0 = pixels (Chrome/Edge)
      //   1 = linhas (Firefox, ~16px/linha)
      //   2 = páginas (raro, ~400px/página)
      const LINE_HEIGHT = 16;
      const PAGE_HEIGHT = el.clientHeight || 400;
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= LINE_HEIGHT;
      else if (e.deltaMode === 2) delta *= PAGE_HEIGHT;

      delta *= multiplier;

      // Só interceptar se há espaço para scrollar na direção pedida
      const atLeftEdge = el.scrollLeft <= 0 && delta < 0;
      const atRightEdge = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1 && delta > 0;
      if (atLeftEdge || atRightEdge) return;

      e.preventDefault();
      el.scrollBy({ left: delta, behavior: 'auto' });
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [ref, disabled, multiplier]);
}
