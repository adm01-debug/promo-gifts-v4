/**
 * FavoritePresentationLauncher — Wrapper que monta os slides da lista
 * e renderiza o PresentationMode existente.
 */
import { useMemo } from 'react';
import {
  PresentationMode,
  type PresentationSlide,
} from '@/components/presentation/PresentationMode';
import type { Product } from '@/types/product-catalog';

interface Props {
  products: Product[];
  listName: string;
  curatorName?: string;
  onClose: () => void;
}

export function FavoritePresentationLauncher({ products, listName, curatorName, onClose }: Props) {
  const slides = useMemo<PresentationSlide[]>(
    () =>
      products.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: p.category_name ?? p.brand ?? undefined,
        imageUrl: p.images?.[0] ?? null,
        description: p.description ?? null,
        details: [
          p.sku ? { label: 'SKU', value: p.sku } : null,
          p.brand ? { label: 'Marca', value: p.brand } : null,
        ].filter((x): x is { label: string; value: string } => !!x),
      })),
    [products],
  );

  return (
    <PresentationMode
      slides={slides}
      title={listName}
      subtitle={curatorName ? `Curadoria de ${curatorName}` : undefined}
      brandName="Promo Gifts"
      onClose={onClose}
    />
  );
}
