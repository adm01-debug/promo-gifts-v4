/**
 * Resolve a imagem específica de um produto baseado nos filtros de cor ativos.
 *
 * Lógica baseada nos dados REAIS do banco:
 * 1. Usa groupSlug e variationSlug (vindos do enriquecimento color_variations → color_groups)
 * 2. Fallback para keyword matching apenas se groupSlug não estiver disponível
 * 3. Retorna color.image (thumbnail da variante daquela cor)
 */

import { getCatalogStockStatus } from '@/lib/catalog-stock-status';
import type { Product, ProductColor } from '@/hooks/products';
import type { ProductVariation } from '@/types/product-catalog';

export interface ActiveColorFilter {
  groups: string[]; // slugs dos grupos selecionados (ex: ['rosa', 'azul'])
  variations: string[]; // slugs das variações selecionadas (ex: ['azul-marinho'])
}

/**
 * Dado um produto e os filtros de cor ativos, retorna a URL da imagem
 * da cor que corresponde ao filtro, ou undefined para fallback.
 */
export function resolveColorImage(
  product: Product,
  activeColors: ActiveColorFilter | null | undefined,
): string | undefined {
  if (!activeColors) return undefined;
  if (!activeColors.groups.length && !activeColors.variations.length) return undefined;
  if (!product.colors?.length) return undefined;

  // Prioridade 1: Variação específica (ex: "azul-marinho")
  if (activeColors.variations.length > 0) {
    for (const variationSlug of activeColors.variations) {
      // Match direto pelo variationSlug do banco
      const match = product.colors.find((c) => c.variationSlug === variationSlug);
      if (match) {
        const img = getColorImage(match);
        if (img) return img;
      }
      // Fallback keyword
      const slugNormalized = variationSlug.toLowerCase().replace(/-/g, ' ');
      const fallback = product.colors.find(
        (c) =>
          c.name.toLowerCase().includes(slugNormalized) ||
          slugNormalized.includes(c.name.toLowerCase()),
      );
      if (fallback) {
        const img = getColorImage(fallback);
        if (img) return img;
      }
    }
  }

  // Prioridade 2: Grupo de cor (ex: "rosa") — usa groupSlug do banco
  if (activeColors.groups.length > 0) {
    for (const groupSlug of activeColors.groups) {
      // Match direto pelo groupSlug do banco de dados
      const match = product.colors.find((c) => c.groupSlug === groupSlug);
      if (match) {
        const img = getColorImage(match);
        if (img) return img;
      }
      // Fallback keyword pelo grupo detectado
      const groupNormalized = groupSlug.toLowerCase().replace(/-/g, ' ');
      const fallback = product.colors.find((c) => {
        const colorGroup = c.group.toLowerCase();
        const colorName = c.name.toLowerCase();
        return (
          colorGroup === groupNormalized ||
          colorGroup.includes(groupNormalized) ||
          colorName.includes(groupNormalized)
        );
      });
      if (fallback) {
        const img = getColorImage(fallback);
        if (img) return img;
      }
    }
  }

  return product.primary_image_url || undefined;
}

/**
 * Extrai a melhor imagem de um ProductColor
 */
function getColorImage(color: ProductColor): string | undefined {
  if (color.images?.length) return color.images[0];
  if (color.image) return color.image;
  return undefined;
}

/**
 * Retorna o nome da cor que está sendo filtrada para o badge
 */
/**
 * Resolve o estoque da variação que corresponde ao filtro de cor ativo.
 * Retorna { stock, stockStatus } ou undefined se nenhum filtro ativo.
 */
/**
 * Resolve o estoque da variação que corresponde a um nome de cor específico ou filtro ativo.
 */
export function resolveColorStock(
  product: Product,
  activeColors: ActiveColorFilter | null | undefined,
  specificColorName?: string | null,
): { stock: number; stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock' } | undefined {
  if (specificColorName && product.variations?.length) {
    const variant = product.variations.find(
      (v) => v.color?.name?.toLowerCase() === specificColorName.toLowerCase(),
    );
    if (variant) {
      const s = variant.stock ?? 0;
      return {
        stock: s,
        stockStatus: getCatalogStockStatus(s),
      };
    }
  }

  if (!activeColors) return undefined;
  if (!activeColors.groups.length && !activeColors.variations.length) return undefined;
  if (!product.variations?.length) return undefined;
  const variations = product.variations;

  const matchVariation = (variationSlug: string) => {
    // Try matching via product.colors first to find the color code
    const colorMatch = product.colors.find((c) => c.variationSlug === variationSlug);
    if (colorMatch?.code) {
      const variant = variations.find(
        (v: ProductVariation) => v.sku === colorMatch.code || v.color?.name === colorMatch.name,
      );
      if (variant) return variant;
    }
    // Direct match via variation color name
    const slugNorm = variationSlug.replace(/-/g, ' ').toLowerCase();
    return variations.find(
      (v: ProductVariation) =>
        v.color?.name?.toLowerCase() === slugNorm ||
        v.color?.name?.toLowerCase().includes(slugNorm),
    );
  };

  const matchGroup = (groupSlug: string) => {
    const colorMatch = product.colors.find((c) => c.groupSlug === groupSlug);
    if (colorMatch?.code) {
      const variant = variations.find(
        (v: ProductVariation) => v.sku === colorMatch.code || v.color?.name === colorMatch.name,
      );
      if (variant) return variant;
    }
    // Sum all variants in this group
    const groupColors = product.colors.filter((c) => c.groupSlug === groupSlug);
    if (groupColors.length > 0) {
      let totalStock = 0;
      for (const gc of groupColors) {
        const v = variations.find((vr: ProductVariation) => vr.color?.name === gc.name);
        if (v) totalStock += v.stock ?? 0;
      }
      return { stock: totalStock };
    }
    return undefined;
  };

  let stock = 0;

  // Prioridade 1: Variação específica
  if (activeColors.variations.length > 0) {
    for (const slug of activeColors.variations) {
      const v = matchVariation(slug);
      if (v) {
        stock = v.stock ?? 0;
        return {
          stock,
          stockStatus: getCatalogStockStatus(stock),
        };
      }
    }
  }

  // Prioridade 2: Grupo - soma estoques de todas variações do grupo
  if (activeColors.groups.length > 0) {
    for (const slug of activeColors.groups) {
      const result = matchGroup(slug);
      if (result) {
        stock = result.stock ?? 0;
        return {
          stock,
          stockStatus: getCatalogStockStatus(stock),
        };
      }
    }
  }

  return undefined;
}

export function getActiveColorName(
  product: Product,
  activeColors: ActiveColorFilter | null | undefined,
): string | undefined {
  if (!activeColors) return undefined;
  if (!activeColors.groups.length && !activeColors.variations.length) return undefined;
  if (!product.colors?.length) return undefined;

  if (activeColors.variations.length > 0) {
    for (const slug of activeColors.variations) {
      const color = product.colors.find((c) => c.variationSlug === slug);
      if (color) return color.name;
      // Fallback keyword
      const slugNormalized = slug.toLowerCase().replace(/-/g, ' ');
      const fb = product.colors.find(
        (c) =>
          c.name.toLowerCase().includes(slugNormalized) ||
          slugNormalized.includes(c.name.toLowerCase()),
      );
      if (fb) return fb.name;
    }
  }

  if (activeColors.groups.length > 0) {
    for (const slug of activeColors.groups) {
      const color = product.colors.find((c) => c.groupSlug === slug);
      if (color) return color.name;
      // Fallback keyword
      const groupNormalized = slug.toLowerCase().replace(/-/g, ' ');
      const fb = product.colors.find(
        (c) =>
          c.group.toLowerCase() === groupNormalized ||
          c.group.toLowerCase().includes(groupNormalized),
      );
      if (fb) return fb.name;
    }
  }

  return undefined;
}
