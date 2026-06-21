import { dbInvoke } from '@/lib/db/postgrest';
import { useQuery } from '@tanstack/react-query';

export interface ExternalVariantStock {
  id: string;
  product_id: string;
  sku: string;
  supplier_sku: string | null;
  color_code: string | null;
  color_name: string | null;
  color_hex: string | null;
  size_code: string | null;
  stock_quantity: number | null;
  next_entry_date: string | null;
  next_entry_quantity: number | null;
  selected_thumbnail: string | null;
  images: string[] | null;
  bitrix_product_id: number | string | null;
}

/**
 * Busca variantes de um produto do banco externo Promobrind
 * com informações de estoque e cores.
 * Enriquece com imagens da tabela product_images via color_code/supplier_code.
 */
export function useExternalVariantStock(productId: string | undefined) {
  return useQuery({
    queryKey: ['external-variant-stock', productId],
    queryFn: async (): Promise<ExternalVariantStock[]> => {
      if (!productId) return [];

      // Buscar variantes e imagens em paralelo
      const [variantsResult, imagesResult] = await Promise.all([
        dbInvoke<{
          id: string;
          product_id: string;
          sku: string;
          supplier_sku: string | null;
          color_code: string | null;
          color_name: string | null;
          color_hex: string | null;
          size_code: string | null;
          stock_quantity: number | null;
          next_entry_date: string | null;
          next_entry_quantity: number | null;
          selected_thumbnail: string | null;
          images: string[] | null;
          bitrix_product_id: number | string | null;
        }>({
          table: 'product_variants',
          operation: 'select',
          select:
            'id, product_id, sku, supplier_sku, color_code, color_name, color_hex, size_code, stock_quantity, next_entry_date, next_entry_quantity, selected_thumbnail, images, bitrix_product_id',
          filters: { product_id: productId, is_active: true },
          limit: 100,
        }),
        dbInvoke<{
          id: string;
          variant_id: string | null;
          supplier_code: string | null;
          url_cdn: string | null;
          is_og_image: boolean | null;
          is_primary: boolean | null;
          image_type: string | null;
        }>({
          table: 'product_images',
          operation: 'select',
          select: 'id, variant_id, supplier_code, url_cdn, is_og_image, is_primary, image_type',
          filters: { product_id: productId },
          limit: 200,
        }),
      ]);

      // Indexar imagens por supplier_code para lookup rápido
      // Priorizar is_og_image (MAIN), excluir tipo 'box'
      const imagesByCode = new Map<string, string>();
      // Indexar imagens por variant_id para lookup direto (XBZ e outros sem color_code)
      const imagesByVariantId = new Map<string, string>();
      for (const img of imagesResult.records) {
        if (!img.url_cdn) continue;
        if (img.image_type === 'box') continue;

        // Indexar por variant_id (vínculo direto mais confiável)
        if (img.variant_id) {
          if (!imagesByVariantId.has(img.variant_id) || img.is_og_image) {
            imagesByVariantId.set(img.variant_id, img.url_cdn);
          }
        }

        // Indexar por supplier_code (vínculo via color_code)
        if (img.supplier_code) {
          const code = img.supplier_code.toUpperCase();
          if (!imagesByCode.has(code) || img.is_og_image) {
            imagesByCode.set(code, img.url_cdn);
          }
        }
      }

      // Detectar imagem principal do produto para evitar usá-la como fallback de variante
      const primaryImages = new Set<string>();
      for (const img of imagesResult.records) {
        if ((img.is_primary || img.is_og_image) && img.url_cdn) {
          primaryImages.add(img.url_cdn);
        }
      }

      return variantsResult.records.map((v) => {
        // 1) Vínculo direto por variant_id (mais confiável — XBZ e outros)
        const variantImage = imagesByVariantId.get(v.id) || null;
        // 2) Vínculo por color_code → supplier_code (Stricker, Asia, etc.)
        const colorImage = v.color_code ? imagesByCode.get(v.color_code.toUpperCase()) : null;

        // selected_thumbnail só é válido se NÃO for a imagem principal do produto
        const isMainImage = v.selected_thumbnail ? primaryImages.has(v.selected_thumbnail) : false;
        const validSelectedThumb =
          v.selected_thumbnail && !isMainImage ? v.selected_thumbnail : null;

        // Prioridade: variantImage > colorImage > selected_thumbnail válido > null
        const thumbnail = variantImage || colorImage || validSelectedThumb || null;
        const imgs = v.images;

        return {
          ...v,
          selected_thumbnail: thumbnail,
          images: imgs,
        };
      });
    },
    enabled: !!productId,
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
