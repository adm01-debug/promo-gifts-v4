/**
 * QuickViewThumb — Wrapper acessível que torna uma thumb clicável e abre o
 * ProductQuickView (paridade total com o catálogo).
 *
 * - role="button" + tabIndex=0 + onKeyDown (Enter/Space) — a11y
 * - stopPropagation no click/keydown — não dispara o onClick do card pai
 * - Lazy: busca o Product completo via useProduct apenas quando o usuário abre
 * - Funciona em qualquer módulo (Novidades, Reposição, Catálogo…) sem
 *   acoplamento ao shape de dados local (Novelty/Replenishment etc).
 */
import { useState } from 'react';
import { ProductQuickView } from './ProductQuickView';
import { useProduct } from '@/hooks/products/useProducts';
import { cn } from '@/lib/utils';

interface QuickViewThumbProps {
  productId: string;
  productName: string;
  /** data-testid aplicado no wrapper clicável (ex.: "novelty-grid-card-thumb"). */
  testId?: string;
  className?: string;
  children: React.ReactNode;
}

export function QuickViewThumb({
  productId,
  productName,
  testId,
  className,
  children,
}: QuickViewThumbProps) {
  const [open, setOpen] = useState(false);
  // Só busca quando o usuário pediu (evita N+1 em listas).
  const { data: product } = useProduct(open ? productId : '');

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
      />
    </>
  );
}
