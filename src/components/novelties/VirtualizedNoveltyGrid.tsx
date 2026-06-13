import { useRef, useState, useLayoutEffect } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import type { NoveltyWithDetails } from '@/hooks/products';
import type { ColumnCount } from '@/components/products/ColumnSelector';
import {
  useResponsiveColumns,
  getGridColsClass,
  getGridGapClass,
} from '@/components/replenishments/grid-layout';
import { NoveltyGridCard } from './NoveltyCards';
import type { ColorDotLike } from '@/components/products/ProductColorSwatches';

interface VirtualizedNoveltyGridProps {
  products: NoveltyWithDetails[];
  gridColumns: ColumnCount;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onProductClick: (id: string) => void;
  onStatusClick?: (type: string, value?: string | number) => void;
  colorsByProduct?: ReadonlyMap<string, readonly ColorDotLike[]>;
}

/**
 * Grade virtualizada de Novidades — espelha a implementação de Reposição
 * para garantir colunas responsivas, espaçamento vertical uniforme (pb-8)
 * e alinhamento interno consistente em todas as resoluções.
 */
export function VirtualizedNoveltyGrid({
  products,
  gridColumns,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onProductClick,
  onStatusClick,
  colorsByProduct,
}: VirtualizedNoveltyGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // BUG-SCROLL-02 FIX: scrollMargin stale no useWindowVirtualizer.
  //
  // PROBLEMA ANTERIOR: `scrollMargin: parentRef.current?.offsetTop ?? 0`
  // era avaliado inline no render. No 1º render, parentRef.current = null
  // → scrollMargin = 0. Em renders posteriores (após mount e CSS vars
  // settlerem), o valor mudava abruptamente para o offsetTop real (~300-520px),
  // fazendo o virtualizer renderizar um conjunto diferente de itens para o
  // mesmo window.scrollY — efeito visual de "snap" de conteúdo.
  //
  // SOLUÇÃO: capturar offsetTop UMA VEZ em useLayoutEffect (pós-mount, antes
  // do paint) via getBoundingClientRect + window.scrollY para obter a posição
  // absoluta na página. Qualquer resize subsequente (ex: toolbar sticky) é
  // capturado pelo ResizeObserver no elemento pai mais próximo.
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    if (!parentRef.current) return;

    // Evita writes redundantes de estado (re-render desnecessário) quando a
    // medição não mudou — só faz setState se o valor realmente diferir.
    let lastMargin = -1;
    const measure = () => {
      if (!parentRef.current) return;
      const rect = parentRef.current.getBoundingClientRect();
      const margin = Math.round(rect.top + window.scrollY);
      if (margin !== lastMargin) {
        lastMargin = margin;
        setScrollMargin(margin);
      }
    };

    measure(); // Medição inicial (pós-mount, offsetTop já definido)

    // BUG-SCROLL-02b FIX (GAP-7): o offsetTop do grid muda não só em resize de
    // window, mas também quando elementos ACIMA dele mudam de altura SEM um
    // resize de viewport — ex.: o sticky header (NoveltyStatsCards) sai do
    // estado Skeleton para os KPIs reais quando os stats async chegam, ou a
    // toolbar sticky cresce. Sem reagir a isso, o scrollMargin ficava stale e
    // o conteúdo "saltava" tardiamente. Solução: ResizeObserver no documentElement
    // (captura qualquer reflow de layout do fluxo do documento) + listener de
    // resize de window (viewport). rAF coalesce múltiplos disparos em 1 medição.
    let rafId: number | null = null;
    const scheduleMeasure = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        measure();
      });
    };

    window.addEventListener('resize', scheduleMeasure, { passive: true });

    const ro = new ResizeObserver(scheduleMeasure);
    // Observa o documentElement: qualquer mudança de altura no fluxo acima do
    // grid (sticky header, KPIs, toolbar) dispara nova medição coalescida.
    ro.observe(document.documentElement);
    // Observa também o próprio parent (mudança de posição relativa ao layout).
    if (parentRef.current) ro.observe(parentRef.current);

    return () => {
      window.removeEventListener('resize', scheduleMeasure);
      ro.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []); // Deps vazias: observers cobrem mudanças subsequentes sem re-subscribe

  const numCols = useResponsiveColumns(gridColumns);
  const rowCount = Math.ceil(products.length / numCols);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => 480,
    overscan: 3,
    scrollMargin, // BUG-SCROLL-02 FIX: estado estável capturado em useLayoutEffect
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  return (
    <div ref={parentRef} role="list" aria-label="Grade de novidades">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * numCols;
          const rowProducts = products.slice(startIdx, startIdx + numCols);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
              }}
              className={`grid ${getGridColsClass(gridColumns)} ${getGridGapClass(gridColumns)} pb-8`}
            >
              {rowProducts.map((product) => (
                <div key={product.novelty_id} role="listitem">
                  <NoveltyGridCard
                    product={product}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(product.product_id)}
                    onSelect={
                      selectionMode
                        ? () => onToggleSelect(product.product_id)
                        : () => onProductClick(product.product_id)
                    }
                    onStatusClick={onStatusClick}
                    colors={colorsByProduct?.get(product.product_id)}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
