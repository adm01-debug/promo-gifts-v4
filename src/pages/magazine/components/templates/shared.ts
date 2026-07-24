/**
 * Utilitários compartilhados entre templates de Magazine.
 * Peças pequenas para manter cada template < 150 LOC.
 */

import type { MagazineContentSettings, MagazineItem } from '@/types/magazine';

/**
 * Placeholder SVG inline (data URI) usado quando produto não tem imagem.
 * Evita broken-img icon e mantém layout estável.
 */
export const PLACEHOLDER_IMAGE =
  `data:image/svg+xml;charset=utf-8,${ 
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#f3f4f6"/><g fill="#9ca3af" font-family="system-ui, sans-serif" text-anchor="middle"><text x="200" y="195" font-size="18">Sem imagem</text><text x="200" y="220" font-size="14">disponível</text></g></svg>`,
  )}`;

export function resolveItemImage(item: MagazineItem): string {
  const color = item.variantColorName
    ? item.productSnapshot.colors.find((c) => c.name === item.variantColorName)
    : undefined;
  return (
    color?.image ||
    item.productSnapshot.image_url ||
    item.productSnapshot.images?.[0] ||
    PLACEHOLDER_IMAGE
  );
}

export function effectiveContent(
  base: MagazineContentSettings,
  overrides: Partial<MagazineContentSettings> | undefined,
): MagazineContentSettings {
  return { ...base, ...(overrides ?? {}) };
}

/**
 * Formata preço em BRL. Quando valor ausente/zero/inválido, retorna "Sob consulta"
 * (padrão B2B: sinaliza negociação e evita exibir "R$ 0,00").
 */
export function formatPrice(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 'Sob consulta';
  }
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

/**
 * Alt-text acessível para imagem de produto em templates de revista.
 * Combina nome do produto + variante de cor quando presente.
 */
export function productImageAlt(item: MagazineItem): string {
  const name = item.productSnapshot?.name?.trim() || 'Produto';
  const color = item.variantColorName?.trim();
  return color ? `${name} — cor ${color}` : name;
}
