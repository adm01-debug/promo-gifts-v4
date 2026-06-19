// Hook para buscar dados do simulador do banco externo Promobrind
import { useQuery } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import { logger } from '@/lib/logger';
import {
  createProductFuseOptions,
  dedupeById,
  rankProductSearchResults,
} from '@/utils/product-search';

// ============================================
// TIPOS
// ============================================

// Schema validado do banco Promobrind (atualizado 04/02/2026)
// NOTA: As imagens agora vêm da tabela product_images, não dos campos legados
export interface ExternalProduct {
  id: string;
  name: string;
  sku: string;
  sale_price: number | null;
  image_url: string | null; // Preenchido via product_images
  images: string[] | null; // Preenchido via product_images
  primary_image_url: string | null; // Preenchido via product_images
  category_id: string | null;
  main_category_id: string | null;
  supplier_reference: string | null;
  description: string | null;
  brand: string | null;
  is_active: boolean;
  active: boolean;
  stock_quantity: number | null;
}

export interface ExternalPrintArea {
  id: string;
  product_id: string;
  component_name: string;
  component_code: string;
  location_name: string;
  location_code: string;
  area_name: string;
  area_code: string;
  supplier_technique_code: string;
  max_width: number | null;
  max_height: number | null;
  max_colors: number | null;
  area_cm2: number | null;
  is_curved: boolean;
  is_primary: boolean;
  is_active: boolean;
  display_order: number;
  serv_code: string | null;
}

export interface GroupedPrintArea {
  componentName: string;
  componentCode: string;
  locations: Array<{
    locationName: string;
    locationCode: string;
    techniques: Array<{
      id: string;
      areaName: string;
      techniqueCode: string;
      maxWidth: number | null;
      maxHeight: number | null;
      maxColors: number | null;
      areaCm2: number | null;
      isCurved: boolean;
      isPrimary: boolean;
      servCode: string | null;
    }>;
  }>;
}

// Tipo para imagem de produto
interface ProductImageRecord {
  product_id: string;
  url_cdn: string;
  image_type: string;
  is_primary: boolean;
  display_order: number;
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
async function dbInvokeLocal<T>(
  table: string,
  operation: 'select',
  options?: {
    filters?: Record<string, unknown>;
    select?: string;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
  },
): Promise<{ records: T[]; count: number | null }> {
  const { dbInvoke } = await import('@/lib/db/postgrest');
  return dbInvoke<T>({
    table,
    operation,
    ...options,
  });
}

// ============================================
// HOOKS
// ============================================

// Select fields que existem no schema Promobrind (campos legados mantidos para fallback)
const PRODUCT_SELECT =
  'id, name, sku, sale_price, primary_image_url, category_id, main_category_id, supplier_reference, description, brand, is_active, active, stock_quantity';

/**
 * Busca produtos do banco externo Promobrind com imagens da nova tabela product_images
 */
export function useExternalProductSearch(searchQuery: string) {
  return useQuery<ExternalProduct[]>({
    queryKey: ['external-products-search', searchQuery],
    queryFn: async () => {
      const normalizedSearch = searchQuery.trim();
      if (!normalizedSearch || normalizedSearch.length < 2) return [];

      const [prefixResult, broadResult] = await Promise.all([
        dbInvokeLocal<ExternalProduct>('products', 'select', {
          filters: {
            _name_prefix: normalizedSearch,
            active: true,
          },
          select: PRODUCT_SELECT,
          limit: 200,
          orderBy: { column: 'name', ascending: true },
        }),
        dbInvokeLocal<ExternalProduct>('products', 'select', {
          filters: {
            _search: normalizedSearch,
            active: true,
          },
          select: PRODUCT_SELECT,
          limit: 500,
          orderBy: { column: 'name', ascending: true },
        }),
      ]);

      const mergedProducts = dedupeById([...prefixResult.records, ...broadResult.records]);
      const fuse = new Fuse(mergedProducts, createProductFuseOptions<ExternalProduct>());
      const products = rankProductSearchResults(mergedProducts, normalizedSearch, fuse);

      // Buscar imagens da nova tabela product_images para enriquecer os produtos
      if (products.length > 0) {
        const productIds = products.map((p) => p.id);

        try {
          const imagesResult = await dbInvokeLocal<ProductImageRecord>('product_images', 'select', {
            filters: { product_id: productIds, is_active: true },
            select: 'product_id, url_cdn, image_type, is_primary, display_order',
            orderBy: { column: 'display_order', ascending: true },
            limit: Math.max(productIds.length * 8, 100),
          });

          // Agrupar imagens por product_id
          const imagesByProduct = new Map<string, ProductImageRecord[]>();
          const productIdSet = new Set(productIds);

          imagesResult.records.forEach((img) => {
            if (!productIdSet.has(img.product_id)) return;

            const productImages = imagesByProduct.get(img.product_id) ?? [];
            imagesByProduct.set(img.product_id, productImages);
            productImages.push(img);
          });

          // Enriquecer produtos com imagens
          products.forEach((product) => {
            const productImages = imagesByProduct.get(product.id);
            if (productImages?.length) {
              productImages.sort((a, b) => a.display_order - b.display_order);

              const primaryImage = productImages.find((img) => img.is_primary) || productImages[0];
              if (primaryImage) {
                product.primary_image_url = primaryImage.url_cdn;
                product.image_url = primaryImage.url_cdn;
              }

              product.images = productImages.map((img) => img.url_cdn);
            }
          });
        } catch (err) {
          logger.warn('Não foi possível buscar imagens da tabela product_images:', err);
        }
      }

      return products;
    },
    enabled: searchQuery.trim().length >= 2,
    staleTime: 30000, // 30 segundos
  });
}

/**
 * Busca um produto específico pelo ID com imagens da nova tabela product_images
 */
export function useExternalProduct(productId: string | null) {
  return useQuery({
    queryKey: ['external-product', productId],
    queryFn: async () => {
      if (!productId) return null;

      const result = await dbInvokeLocal<ExternalProduct>('products', 'select', {
        filters: { id: productId },
        select: PRODUCT_SELECT,
        limit: 1,
      });

      const product = result.records[0] || null;

      // Buscar imagens da nova tabela product_images
      if (product) {
        try {
          const imagesResult = await dbInvokeLocal<ProductImageRecord>('product_images', 'select', {
            filters: { product_id: productId, is_active: true },
            select: 'product_id, url_cdn, image_type, is_primary, display_order',
            orderBy: { column: 'display_order', ascending: true },
            limit: 100,
          });

          if (imagesResult.records.length > 0) {
            const sortedImages = imagesResult.records.sort(
              (a, b) => a.display_order - b.display_order,
            );

            const primaryImage = sortedImages.find((img) => img.is_primary) || sortedImages[0];
            if (primaryImage) {
              product.primary_image_url = primaryImage.url_cdn;
              product.image_url = primaryImage.url_cdn;
            }

            product.images = sortedImages.map((img) => img.url_cdn);
          }
        } catch (err) {
          logger.warn('Não foi possível buscar imagens da tabela product_images:', err);
        }
      }

      return product;
    },
    enabled: !!productId,
    staleTime: 60000, // 1 minuto
  });
}

/**
 * Busca áreas de gravação de um produto do banco externo
 * Agrupa por componente > local > técnica
 */
export function useExternalPrintAreas(productId: string | null) {
  return useQuery({
    queryKey: ['external-print-areas', productId],
    queryFn: async () => {
      if (!productId) return [];

      // Buscar áreas da tabela print_area_techniques (SSOT)
      const { fetchPrintAreasFromProduct } = await import('@/lib/fetch-print-areas');
      const fetchedAreas = await fetchPrintAreasFromProduct(productId);
      const result = { records: fetchedAreas as unknown as ExternalPrintArea[] };

      // Agrupar por componente > local > técnica
      const grouped: Record<string, GroupedPrintArea> = {};

      for (const area of result.records) {
        const compKey = area.component_code || 'default';

        if (!grouped[compKey]) {
          grouped[compKey] = {
            componentName: area.component_name || 'Produto',
            componentCode: area.component_code || 'default',
            locations: [],
          };
        }

        const comp = grouped[compKey];
        let location = comp.locations.find((l) => l.locationCode === area.location_code);

        if (!location) {
          location = {
            locationName: area.location_name,
            locationCode: area.location_code,
            techniques: [],
          };
          comp.locations.push(location);
        }

        location.techniques.push({
          id: area.id,
          areaName: area.area_name,
          techniqueCode: area.supplier_technique_code,
          maxWidth: area.max_width,
          maxHeight: area.max_height,
          maxColors: area.max_colors,
          areaCm2: area.area_cm2,
          isCurved: area.is_curved,
          isPrimary: area.is_primary,
          servCode: area.serv_code,
        });
      }

      return Object.values(grouped);
    },
    enabled: !!productId,
    staleTime: 60000, // 1 minuto
  });
}

/**
 * Busca todos os produtos do banco externo (lista completa) com imagens da nova tabela
 */
export function useExternalProductsList(options?: {
  limit?: number;
  onlyWithPrintAreas?: boolean;
}) {
  return useQuery({
    queryKey: ['external-products-list', options],
    queryFn: async () => {
      const result = await dbInvokeLocal<ExternalProduct>('products', 'select', {
        filters: {
          active: true,
        },
        select: 'id, name, sku, sale_price, primary_image_url, supplier_reference, brand',
        limit: options?.limit || 100,
        orderBy: { column: 'name', ascending: true },
      });

      const products = result.records;

      // Buscar imagens da nova tabela product_images
      if (products.length > 0) {
        const productIds = products.map((p) => p.id);

        try {
          const imagesResult = await dbInvokeLocal<ProductImageRecord>('product_images', 'select', {
            filters: { is_active: true },
            select: 'product_id, url_cdn, image_type, is_primary, display_order',
            orderBy: { column: 'display_order', ascending: true },
            limit: 2000,
          });

          // Agrupar imagens por product_id
          const imagesByProduct = new Map<string, ProductImageRecord[]>();
          const productIdSet = new Set(productIds);

          imagesResult.records.forEach((img) => {
            if (!productIdSet.has(img.product_id)) return;

            const productImages = imagesByProduct.get(img.product_id) ?? [];
            imagesByProduct.set(img.product_id, productImages);
            productImages.push(img);
          });

          // Enriquecer produtos com imagens
          products.forEach((product) => {
            const productImages = imagesByProduct.get(product.id);
            if (productImages?.length) {
              productImages.sort((a, b) => a.display_order - b.display_order);

              const primaryImage = productImages.find((img) => img.is_primary) || productImages[0];
              if (primaryImage) {
                product.primary_image_url = primaryImage.url_cdn;
                product.image_url = primaryImage.url_cdn;
              }

              product.images = productImages.map((img) => img.url_cdn);
            }
          });
        } catch (err) {
          logger.warn('Não foi possível buscar imagens da tabela product_images:', err);
        }
      }

      return products;
    },
    staleTime: 60000, // 1 minuto
  });
}
