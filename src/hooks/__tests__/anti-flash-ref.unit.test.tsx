import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef, useEffect, useState } from 'react';

/**
 * GAP-2 RUNTIME VALIDATION (BUG-G7 ciclo).
 *
 * O hook real useCatalogState usa um padrao useRef+useEffect para evitar o
 * "flash de empty state" durante transicoes de sort. A logica vive em
 * useCatalogState.ts (~linha 474):
 *
 *   const lastNonTransitionedProductsRef = useRef<Product[]>([]);
 *   useEffect(() => {
 *     if (!isTransitioning) {
 *       lastNonTransitionedProductsRef.current = filteredProducts;
 *     }
 *   }, [isTransitioning, filteredProducts]);
 *   const displayFilteredProducts = isTransitioning
 *     ? lastNonTransitionedProductsRef.current
 *     : filteredProducts;
 *
 * O teste runtime do hook COMPLETO (useCatalogState.unit.test.tsx) esta skipped
 * por OOM do worker (cascata Supabase+contexts). Validamos AQUI a MESMA mecanica
 * em isolamento com renderHook real — React de verdade, sem mocks pesados — para
 * garantir que o padrao anti-flash funciona no runtime, nao so em simulacao.
 */

// Replica fiel e MINIMA da mecanica do hook real (mesmo shape, sem deps pesadas).
function useAntiFlashDisplay<T>(items: T[], isTransitioning: boolean): T[] {
  const lastStableRef = useRef<T[]>([]);
  useEffect(() => {
    if (!isTransitioning) {
      lastStableRef.current = items;
    }
  }, [isTransitioning, items]);
  return isTransitioning ? lastStableRef.current : items;
}

describe('GAP-2 anti-flash useRef — runtime React real (renderHook)', () => {
  it('exibe lista normal quando NAO esta em transicao', () => {
    const A = [1, 2, 3];
    const { result } = renderHook(({ items, t }) => useAntiFlashDisplay(items, t), {
      initialProps: { items: A, t: false },
    });
    expect(result.current).toEqual([1, 2, 3]);
  });

  it('CONGELA a ultima lista estavel durante a transicao (sem flash de vazio)', () => {
    const A = [1, 2, 3];
    const EMPTY: number[] = [];
    const { result, rerender } = renderHook(({ items, t }) => useAntiFlashDisplay(items, t), {
      initialProps: { items: A, t: false },
    });
    // estado estavel: mostra A; o effect grava A no ref
    expect(result.current).toEqual([1, 2, 3]);

    // inicia transicao E os dados ficam vazios no mesmo render (pior caso)
    rerender({ items: EMPTY, t: true });

    // SEM o fix: mostraria [] (flash). COM o ref: mostra A congelado.
    expect(result.current).toEqual([1, 2, 3]);
  });

  it('libera a NOVA lista quando a transicao termina', () => {
    const A = [1, 2, 3];
    const B = [9, 8];
    const { result, rerender } = renderHook(({ items, t }) => useAntiFlashDisplay(items, t), {
      initialProps: { items: A, t: false },
    });
    expect(result.current).toEqual([1, 2, 3]);

    // transicao com dados novos chegando
    rerender({ items: B, t: true });
    expect(result.current).toEqual([1, 2, 3]); // congela A

    // fim da transicao → mostra B e atualiza o ref
    rerender({ items: B, t: false });
    expect(result.current).toEqual([9, 8]);
  });

  it('transicoes encadeadas: A→B→C nunca pisca vazio entre elas', () => {
    const A = [1];
    const B = [2, 2];
    const C = [3, 3, 3];
    const EMPTY: number[] = [];
    const { result, rerender } = renderHook(({ items, t }) => useAntiFlashDisplay(items, t), {
      initialProps: { items: A, t: false },
    });
    expect(result.current).toEqual(A);

    // transicao 1: dados somem momentaneamente
    rerender({ items: EMPTY, t: true });
    expect(result.current).toEqual(A); // congela A, nao []
    rerender({ items: B, t: false });
    expect(result.current).toEqual(B);

    // transicao 2 imediata
    rerender({ items: EMPTY, t: true });
    expect(result.current).toEqual(B); // congela B, nao []
    rerender({ items: C, t: false });
    expect(result.current).toEqual(C);
  });

  it('integra com useState real disparando a transicao de dentro de act()', () => {
    function useScenario() {
      const [items, setItems] = useState<number[]>([10, 20]);
      const [t, setT] = useState(false);
      const display = useAntiFlashDisplay(items, t);
      return { display, setItems, setT };
    }
    const { result } = renderHook(() => useScenario());
    expect(result.current.display).toEqual([10, 20]);

    // dispara transicao + esvazia dados (como um sort faria)
    act(() => {
      result.current.setT(true);
      result.current.setItems([]);
    });
    expect(result.current.display).toEqual([10, 20]); // congelado

    // novos dados + fim da transicao
    act(() => {
      result.current.setItems([30, 40, 50]);
      result.current.setT(false);
    });
    expect(result.current.display).toEqual([30, 40, 50]);
  });
});
