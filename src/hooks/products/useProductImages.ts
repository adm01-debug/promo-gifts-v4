/**
 * Hook para buscar imagens de produtos da tabela product_images (BD externo Promobrind)
 *
 * IMPORTANTE: Este hook substitui a lógica legada que buscava imagens dos campos
 * image_url, images, primary_image_url da tabela products.
 *
 * A nova estrutura usa a tabela product_images com campos:
 * - url_cdn: URL da imagem no CDN
 * - image_type: Tipo (main, gallery, set, logo, box, etc.)
 * - is_primary: Se é a imagem principal
 * - display_order: Ordem de exibição
 * - alt_text: Texto alternativo (SEO)
 * - is_active: Se está ativa
 */

import { dbInvoke } from '@/lib/db/postgrest';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

// ============================================
// TIPOS
// ============================================

export interface ProductImage {
  id: string;
  product_id: string;
  variant_id: string | null;
  color_id: string | null;
  /** Código do fornecedor (ex: "105") — vincula imagem à cor via color_code da variante */
  supplier_code: string | null;
  /** Sinal semântico: true = imagem pertence a uma cor específica (use este, não supplier_code) */
  applies_to_color: boolean | null;
  /** ID da imagem no Cloudflare Images — use com getCdnVariantUrl() para gerar URLs de variantes */
  cloudflare_image_id: string;
  url_cdn: string;
  url_original: string | null;
  image_type: string;
  is_primary: boolean;
  is_og_image: boolean;
  display_order: number;
  is_active: boolean;
  alt_text: string | null;
  title_text: string | null;
  /** Largura em pixels — disponível após processamento pelo image-dimensions-worker */
  width_px: number | null;
  /** Altura em pixels — disponível após processamento pelo image-dimensions-worker */
  height_px: number | null;
}

export interface ProductImageForDisplay {
  url: string;
  type: string;
  alt: string | null;
  order: number;
  isPrimary: boolean;
  width: number | null;
  height: number | null;
}

const CF_BASE = 'https://imagedelivery.net/vKMs9Ow8bA_enuhLXZ2HAw';

/**
 * Gera URL de variante do Cloudflare Images.
 * Variantes disponíveis: public, thumbnail, small, medium, large
 */
export function getCdnVariantUrl(
  cloudflareImageId: string,
  variant: 'large' | 'medium' | 'public' | 'small' | 'thumbnail' = 'public',
): string {
  return `${CF_BASE}/${cloudflareImageId}/${variant}`;
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Busca todas as imagens ativas de um produto
 */
export async function fetchProductImages(productId: string): Promise<ProductImage[]> {
  try {
    const result = await dbInvoke<ProductImage>({
      table: 'product_images',
      operation: 'select',
      select:
        'id, product_id, variant_id, color_id, supplier_code, applies_to_color, cloudflare_image_id, url_cdn, url_original, image_type, is_primary, is_og_image, display_order, is_active, alt_text, title_text, width_px, height_px',
      filters: {
        product_id: productId,
        is_active: true,
      },
      orderBy: { column: 'display_order', ascending: true },
      limit: 100,
    });

    return result.records;
  } catch (err) {
    logger.warn('Erro ao buscar imagens do produto:', productId, err);
    return [];
  }
}

/**
 * Tamanho do chunk de product_ids por query IN(). Alinhado com o enriquecimento
 * em src/lib/external-db/products.ts (CHUNK_SIZE=80) para manter a URL do
 * PostgREST dentro de limites seguros.
 */
const IMAGE_BATCH_CHUNK_SIZE = 80;

/**
 * Busca imagens de múltiplos produtos de uma vez (batch).
 *
 * Usa filtro `IN(product_id)` (suportado pelo PostgREST via array — ver
 * postgrest.ts `query.in(key, value)`), em chunks, em vez de baixar a tabela
 * inteira e filtrar em memória. Isso evita transferir milhares de linhas e o
 * truncamento silencioso pelo teto de `limit`.
 */
export async function fetchProductImagesBatch(
  productIds: string[],
): Promise<Map<string, ProductImage[]>> {
  if (productIds.length === 0) return new Map();

  const uniqueIds = [...new Set(productIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += IMAGE_BATCH_CHUNK_SIZE) {
    chunks.push(uniqueIds.slice(i, i + IMAGE_BATCH_CHUNK_SIZE));
  }

  try {
    const results = await Promise.all(
      chunks.map((chunk) =>
        dbInvoke<ProductImage>({
          table: 'product_images',
          operation: 'select',
          select:
            'id, product_id, variant_id, color_id, supplier_code, applies_to_color, cloudflare_image_id, url_cdn, url_original, image_type, is_primary, is_og_image, display_order, is_active, alt_text, title_text, width_px, height_px',
          filters: { is_active: true, product_id: chunk },
          orderBy: { column: 'display_order', ascending: true },
          limit: 1000,
        }),
      ),
    );

    // Agrupar por product_id
    const imagesByProduct = new Map<string, ProductImage[]>();
    for (const result of results) {
      result.records.forEach((image) => {
        const productImages = imagesByProduct.get(image.product_id) ?? [];
        imagesByProduct.set(image.product_id, productImages);
        productImages.push(image);
      });
    }

    return imagesByProduct;
  } catch (err) {
    logger.warn('Erro ao buscar imagens em batch:', err);
    return new Map();
  }
}

/**
 * Busca apenas a imagem principal de um produto
 */
export async function fetchPrimaryImage(productId: string): Promise<string | null> {
  try {
    const result = await dbInvoke<ProductImage>({
      table: 'product_images',
      operation: 'select',
      select: 'url_cdn, alt_text',
      filters: {
        product_id: productId,
        is_primary: true,
        is_active: true,
      },
      limit: 1,
    });

    return result.records[0]?.url_cdn || null;
  } catch (err) {
    logger.warn('Erro ao buscar imagem principal:', productId, err);
    return null;
  }
}

/**
 * Transforma imagens do banco para formato de exibição
 */
export function transformToDisplayImages(images: ProductImage[]): ProductImageForDisplay[] {
  return images.map((img) => ({
    url: img.url_cdn,
    type: img.image_type,
    alt: img.alt_text,
    order: img.display_order,
    isPrimary: img.is_primary,
    width: img.width_px,
    height: img.height_px,
  }));
}

/**
 * Extrai a imagem principal de uma lista de imagens
 */
export function getPrimaryImageUrl(images: ProductImage[]): string | null {
  const primary = images.find((img) => img.is_primary);
  if (primary) return primary.url_cdn;

  // Fallback: primeira imagem por ordem
  const sorted = [...images].sort((a, b) => a.display_order - b.display_order);
  return sorted[0]?.url_cdn || null;
}

/**
 * Extrai URLs de imagens como array simples
 */
export function getImageUrls(images: ProductImage[]): string[] {
  return images.sort((a, b) => a.display_order - b.display_order).map((img) => img.url_cdn);
}

// ============================================
// HOOKS
// ============================================

/**
 * Hook para buscar todas as imagens de um produto
 */
export function useProductImages(productId: string | null) {
  return useQuery({
    queryKey: ['product-images', productId],
    queryFn: async () => {
      if (!productId) return [];
      return fetchProductImages(productId);
    },
    enabled: !!productId,
    staleTime: 15 * 60 * 1000, // Aumentado para 15 min (dados estáveis)
  });
}

/**
 * Hook para buscar imagens de múltiplos produtos
 */
export function useProductImagesBatch(productIds: string[]) {
  return useQuery({
    queryKey: ['product-images-batch', [...productIds].sort().join(',')],
    queryFn: async () => {
      if (productIds.length === 0) return new Map<string, ProductImage[]>();
      return fetchProductImagesBatch(productIds);
    },
    enabled: productIds.length > 0,
    staleTime: 15 * 60 * 1000,
  });
}

/**
 * Hook para buscar apenas a imagem principal
 */
export function usePrimaryImage(productId: string | null) {
  return useQuery({
    queryKey: ['product-primary-image', productId],
    queryFn: async () => {
      if (!productId) return null;
      return fetchPrimaryImage(productId);
    },
    enabled: !!productId,
    staleTime: 15 * 60 * 1000,
  });
}
