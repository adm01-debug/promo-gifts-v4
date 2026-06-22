/**
 * QuickViewThumb — Wrapper acessível que torna uma thumb clicável e abre o
 * ProductQuickView (paridade total com o catálogo).
 *
 * - role="button" + tabIndex=0 + onKeyDown (Enter/Space) — a11y
 * - stopPropagation no click/keydown — não dispara o onClick do card pai
 * - Lazy: busca o Product completo via useProduct apenas quando o usuário abre
 * - Funciona em qualquer módulo (Novidades, Reposição, Catálogo, Estoque…)
 *
 * Cor inicial:
 *  - `initialColorName` (prop): cor padrão usada quando o usuário clica na imagem
 *    (ex.: a cor ativa do mini-carrossel do card).
 *  - `ref.current.open(colorName)`: handle imperativo para abrir o QuickView a
 *    partir de outro gatilho (ex.: clique numa bolinha de cor fora do thumb)
 *    posicionado naquela cor específica. Sobrescreve `initialColorName` para a
 *    abertura corrente.
 */
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ProductQuickView } from './ProductQuickView';
import { useProduct } from '@/hooks/products/useProducts';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { cn } from '@/lib/utils';
import type { Product } from '@/hooks/products';

export interface QuickViewThumbHandle {
  /** Abre o QuickView. Quando `colorName` é informado, pré-seleciona a cor. */
  open: (colorName?: string | null) => void;
}

interface QuickViewThumbProps {
  productId: string;
  productName: string;
  /** data-testid aplicado no wrapper clicável (ex.: "novelty-grid-card-thumb"). */
  testId?: string;
  className?: string;
  children: ReactNode;
  /** Cor pré-selecionada ao abrir via clique na imagem. */
  initialColorName?: string | null;
  /** Opcional: passado pelo catálogo/módulos que têm fluxo próprio. */
  onAddToQuote?: (product: Product) => void;
  onAddToCollection?: (product: Product) => void;
  onShare?: (product: Product) => void;
  onNavigateToProduct?: (productId: string) => void;
}

export const QuickViewThumb = forwardRef<QuickViewThumbHandle, QuickViewThumbProps>(
  function QuickViewThumb(
    {
      productId,
      productName,
      testId,
      className,
      children,
      initialColorName = null,
      onAddToQuote,
      onAddToCollection,
      onShare,
      onNavigateToProduct,
    },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    // Cor passada via handle imperativo sobrescreve a prop para a abertura atual.
    // Resetada para `undefined` ao fechar para evitar vazamento de estado entre aberturas.
    const overrideColorRef = useRef<string | null | undefined>(undefined);
    const [overrideTick, setOverrideTick] = useState(0);
    const initialColor =
      overrideColorRef.current !== undefined ? overrideColorRef.current : initialColorName;

    useImperativeHandle(
      ref,
      () => ({
        open: (colorName) => {
          overrideColorRef.current = colorName ?? null;
          // Força re-render para que o ProductQuickView receba o novo initialColorName.
          setOverrideTick((t) => t + 1);
          setOpen(true);
        },
      }),
      [],
    );

    // Só busca quando o usuário pediu (evita N+1 em listas).
    const { data: product, isLoading } = useProduct(open ? productId : '');

    // Estado global: paridade com o ProductCard do catálogo.
    const isFavorite = useFavoritesStore((s) => s.isFavorite);
    const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
    const isInCompare = useComparisonStore((s) => s.isInCompare);
    const toggleCompare = useComparisonStore((s) => s.toggleCompare);

    return (
      <>
        <div
          role="button"
          tabIndex={0}
          aria-label={`Visualização rápida de ${productName}`}
          data-testid={testId}
          className={cn('cursor-zoom-in', className)}
          onClick={(e) => {
            e.stopPropagation();
            overrideColorRef.current = undefined;
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              overrideColorRef.current = undefined;
              setOpen(true);
            }
          }}
        >
          {children}
        </div>
        <ProductQuickView
          key={overrideTick}
          product={product ?? null}
          isLoading={isLoading}
          open={open}
          onOpenChange={(v) => {
            if (!v) {
              setOpen(false);
              overrideColorRef.current = undefined;
            }
          }}
          initialColorName={initialColor ?? null}
          isFavorited={isFavorite(productId)}
          onToggleFavorite={toggleFavorite}
          isInCompare={isInCompare(productId)}
          onToggleCompare={(id) => toggleCompare(id)}
          onAddToQuote={onAddToQuote}
          onAddToCollection={onAddToCollection}
          onShare={onShare}
          onNavigateToProduct={onNavigateToProduct}
        />
      </>
    );
  },
);
