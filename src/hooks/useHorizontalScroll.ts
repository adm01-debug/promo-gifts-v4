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
 *   - Normaliza deltaMode: 0=pixel, 1=linha(×16), 2=página(×clientHeight)
 *
 * Guards de borda:
 *   - atLeftEdge:  scrollLeft < 1 E tentando scrollar esquerda → browser retoma
 *     (< 1 cobre subpixel: DPR=2 pode retornar scrollLeft=0.5 quando está no início)
 *   - atRightEdge: scrollLeft >= maxScroll - 1 E scrollLeft > 0 E tentando scrollar direita
 *     ↑ A condição `scrollLeft > 0` previne false positive quando maxScroll é mínimo
 *       (ex: scrollWidth = clientWidth + 1, scrollLeft = 0: 0 >= 0 seria TRUE sem o guard)
 *
 * Requer { passive: false } para poder chamar preventDefault().
 * O hook registra o listener diretamente no DOM (não via React sintético)
 * para garantir o passive:false independente da versão do React.
 *
 * fix_version: horizontal-scroll-hook-v2 — NÃO REMOVER ESTE COMENTÁRIO
 * (v2: fix atRightEdge false positive com overflow mínimo, scrollLeft=0)
 * (v2.1: fix atLeftEdge subpixel — usa < 1 em vez de <= 0 para DPR > 1)
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
      //   2 = páginas (raro, ~clientHeight por página)
      const LINE_HEIGHT = 16;
      const PAGE_HEIGHT = el.clientHeight || 400;
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= LINE_HEIGHT;
      else if (e.deltaMode === 2) delta *= PAGE_HEIGHT;

      delta *= multiplier;

      const maxScroll = el.scrollWidth - el.clientWidth;

      // Só interceptar se há espaço para scrollar na direção pedida.
      // atLeftEdge: scrollLeft no início e tentando ir à esquerda.
      // Usa < 1 em vez de <= 0 para cobrir subpixel em DPR > 1:
      // browsers com DPR=2 podem retornar scrollLeft=0.5 mesmo "no início".
      // Simetria com atRightEdge que usa tolerância de -1 na borda direita.
      const atLeftEdge = el.scrollLeft < 1 && delta < 0;

      // atRightEdge: scrollLeft próximo do fim (tolerância 1px para subpixel em DPR>1).
      // A condição `el.scrollLeft > 0` é essencial: sem ela, quando maxScroll=1 e
      // scrollLeft=0, teríamos `0 >= maxScroll(1) - 1 = 0` → TRUE (false positive).
      const atRightEdge = el.scrollLeft > 0 && el.scrollLeft >= maxScroll - 1 && delta > 0;

      if (atLeftEdge || atRightEdge) return;

      e.preventDefault();
      el.scrollBy({ left: delta, behavior: 'auto' });
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [ref, disabled, multiplier]);
}
