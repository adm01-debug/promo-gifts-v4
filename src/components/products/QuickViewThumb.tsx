/**
 * QuickViewThumb — Wrapper acessível que torna uma thumb clicável e abre o
 * ProductQuickView (paridade total com o catálogo).
 *
 * - role="button" + tabIndex=0 + onKeyDown (Enter/Space) — a11y
 * - stopPropagation no click/keydown — não dispara o onClick do card pai
 * - Lazy: busca o Product completo via useProduct apenas quando o usuário abre
 * - Funciona em qualquer módulo (Novidades, Reposição, Catálogo, Estoque…)
 *   sem acoplamento ao shape de dados local
 *
 * Ações globais (Favoritos + Comparar) são ligadas internamente usando o
 * mesmo store/hook que o catálogo usa, garantindo que TODOS os botões do
 * QuickView apareçam mesmo quando o módulo (ex.: Estoque) não passa props.
 * Handlers de Cotação/Coleção/Share podem ser injetados via props quando o
 * módulo tiver um destino próprio.
 */
import { useState } from 'react';
import { ProductQuickView } from './ProductQuickView';
import { useProduct } from '@/hooks/products/useProducts';
import { useFavorites } from '@/hooks/favorites/useFavorites';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { cn } from '@/lib/utils';
import type { Product } from '@/hooks/products';

interface QuickViewThumbProps {
  productId: string;
  productName: string;
  /** data-testid aplicado no wrapper clicável (ex.: "novelty-grid-card-thumb"). */
  testId?: string;
  className?: string;
  children: React.ReactNode;
  /** Opcional: passado pelo catálogo/módulos que têm fluxo próprio. */
  onAddToQuote?: (product: Product) => void;
  onAddToCollection?: (product: Product) => void;
  onShare?: (product: Product) => void;
  onNavigateToProduct?: (product: Product) => void;
}

export function QuickViewThumb({
  productId,
  productName,
  testId,
  className,
  children,
  onAddToQuote,
  onAddToCollection,
  onShare,
  onNavigateToProduct,
}: QuickViewThumbProps) {
  const [open, setOpen] = useState(false);
  // Só busca quando o usuário pediu (evita N+1 em listas).
  const { data: product } = useProduct(open ? productId : '');

  // Estado global: paridade com o ProductCard do catálogo.
  const { isFavorite, toggleFavorite } = useFavorites();
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
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
      >
        {children}
      </div>
      <ProductQuickView
        product={product ?? null}
        open={open && !!product}
        onOpenChange={(v) => {
          if (!v) setOpen(false);
        }}
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
}
