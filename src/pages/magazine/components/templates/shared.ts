/**
 * Utilitários compartilhados entre templates de Magazine.
 * Peças pequenas para manter cada template < 150 LOC.
 */

import type { MagazineContentSettings, MagazineItem } from '@/types/magazine';

export function resolveItemImage(item: MagazineItem): string {
  const color = item.variantColorName
    ? item.productSnapshot.colors.find((c) => c.name === item.variantColorName)
    : undefined;
  return (
    color?.image ||
    item.productSnapshot.image_url ||
    item.productSnapshot.images?.[0] ||
    ''
  );
}

export function effectiveContent(
  base: MagazineContentSettings,
  overrides: Partial<MagazineContentSettings> | undefined,
): MagazineContentSettings {
  return { ...base, ...(overrides ?? {}) };
}

export function formatPrice(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function itemPrice(item: MagazineItem): number | undefined {
  return item.productSnapshot.sale_price ?? item.productSnapshot.price;
}
