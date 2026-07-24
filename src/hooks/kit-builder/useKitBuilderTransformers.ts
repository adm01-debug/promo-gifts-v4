/**
 * Kit Builder Transformers
 * Pure functions to transform external DB products into Kit types.
 */

import {
  type KitBox,
  type KitItem,
  type ExternalProductForKit,
  mmToCm,
  calculateVolume,
  extractProductDimensions,
  estimateDefaultDimensions,
} from '@/lib/kit-builder';

// Local equivalents of the external-db helpers, typed against ExternalProductForKit.
// (The shared helpers require the full PromobrindProduct shape, which the kit-builder
// product subset does not satisfy; the logic mirrors `getProductImageUrl`/`getProductPrice`.)
function resolveProductImageUrl(product: ExternalProductForKit): string | null {
  return product.primary_image_url || product.image_url || (product.images?.[0] ?? null);
}

function resolveProductPrice(product: ExternalProductForKit): number {
  return product.sale_price ?? product.base_price ?? 0;
}

function resolveProductMaterial(product: ExternalProductForKit): string | undefined {
  if (product.material) return product.material;
  if (!Array.isArray(product.materials) || product.materials.length === 0) return undefined;

  const firstMaterial = product.materials[0];
  if (typeof firstMaterial === 'string') return firstMaterial;
  if (firstMaterial && typeof firstMaterial === 'object') {
    const candidate =
      (firstMaterial as { name?: string; material?: string }).name ??
      (firstMaterial as { name?: string; material?: string }).material;
    return typeof candidate === 'string' && candidate.trim() ? candidate : undefined;
  }

  return undefined;
}

export function transformToKitBox(product: ExternalProductForKit): KitBox | null {
  let dimensions: { width: number; height: number; depth: number } | null = null;

  const wMm = mmToCm(product.width_mm);
  const hMm = mmToCm(product.height_mm);
  const lMm = mmToCm(product.length_mm);
  if (wMm && hMm && lMm) {
    dimensions = { width: wMm, height: hMm, depth: lMm };
  }

  if (!dimensions) {
    dimensions = extractProductDimensions(product);
  }

  if (!dimensions) return null;

  // Guard against zero dimensions
  if (dimensions.width <= 0 || dimensions.height <= 0 || dimensions.depth <= 0) return null;

  const volume = calculateVolume(dimensions.width, dimensions.height, dimensions.depth);

  // Estimate max weight based on material
  let maxWeight: number | undefined;
  const mat = resolveProductMaterial(product)?.toLowerCase() ?? '';
  if (mat.includes('micro') || mat.includes('papelão')) maxWeight = 2000;
  else if (mat.includes('kraft') || mat.includes('cartão')) maxWeight = 3000;
  else if (mat.includes('madeira') || mat.includes('mdf')) maxWeight = 10000;
  else if (mat.includes('metal') || mat.includes('lata')) maxWeight = 15000;

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    imageUrl: resolveProductImageUrl(product),
    price: resolveProductPrice(product),
    internalWidth: dimensions.width,
    internalHeight: dimensions.height,
    internalDepth: dimensions.depth,
    internalVolume: volume,
    material: resolveProductMaterial(product),
    weight: product.weight_g ?? undefined,
    maxWeight,
  };
}

export function transformToKitItem(product: ExternalProductForKit, category?: string): KitItem {
  let dimensions: { width: number; height: number; depth: number } | null = null;

  const wMm = mmToCm(product.width_mm);
  const hMm = mmToCm(product.height_mm);
  const lMm = mmToCm(product.length_mm);
  if (wMm && hMm && lMm) {
    dimensions = { width: wMm, height: hMm, depth: lMm };
  }

  if (!dimensions) {
    dimensions = extractProductDimensions(product) || estimateDefaultDimensions(category);
  }

  const volume = calculateVolume(dimensions.width, dimensions.height, dimensions.depth);

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    imageUrl: resolveProductImageUrl(product),
    price: resolveProductPrice(product),
    width: dimensions.width,
    height: dimensions.height,
    depth: dimensions.depth,
    volume,
    weight: product.weight_g ?? undefined,
    material: resolveProductMaterial(product),
    category,
    quantity: 1,
    isOptional: false,
    isReplaceable: product.is_replaceable ?? false,
    allowsPersonalization: product.allows_personalization ?? true,
    allowedVariantIds: product.allowed_variant_ids ?? undefined,
  };
}
