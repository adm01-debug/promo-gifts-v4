/**
 * useSimilarProducts — Fetches similar products via the external DB.
 *
 * Strategy:
 * 1. RPC `fn_get_similar_products` — BIDIRECTIONAL (checks both product_id AND related_product_id).
 *    Fixes the unidirectional gap caused by idx_product_relationships_canonical_pair.
 * 2. Fallback: Query `product_group_members` for group-based siblings
 * 3. Last resort: Related products from same supplier/category
 *
 * All levels use lightweight batch queries (no individual product detail fetches).
 */
import { supabase } from '@/integrations/supabase/client';
import { dbInvoke } from '@/lib/db/postgrest';
import { useQuery } from '@tanstack/react-query';
import type { Product } from '@/types/product-catalog';
import { logger } from '@/lib/logger';

/** Produto similar retornado pelo hook para exibição nos cards de relacionados. */
export interface SimilarProductItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  image_url: string;
  supplier_name: string;
  category_name: string;
  category_id?: string;
  colors_count?: number;
  stock?: number;
}

/** Lightweight product columns needed for similar product cards */
const SIMILAR_PRODUCT_SELECT =
  'id,name,sku,sale_price,primary_image_url,supplier_id,stock_quantity,brand,category_id';

interface LightweightProduct {
  id: string;
  name: string;
  sku: string;
  sale_price: number;
  primary_image_url: string;
  supplier_id: string;
  stock_quantity: number;
  brand: string;
  category_id: string;
}

function mapLightweightToSimilarItem(p: LightweightProduct): SimilarProductItem {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: p.sale_price,
    image_url: p.primary_image_url || '/placeholder.svg',
    supplier_name: p.brand || 'Fornecedor',
    category_name: '',
    category_id: p.category_id || undefined,
    colors_count: 0,
    stock: p.stock_quantity || 0,
  };
}

/** Batch-fetch lightweight product data by an array of IDs */
async function fetchProductsByIds(ids: string[]): Promise<SimilarProductItem[]> {
  if (ids.length === 0) return [];

  const { records } = await dbInvoke<LightweightProduct>({
    table: 'products',
    operation: 'select',
    select: SIMILAR_PRODUCT_SELECT,
    filters: { id: ids, active: true },
    limit: ids.length,
  });

  return (records || []).filter((p) => p.sale_price > 0).map(mapLightweightToSimilarItem);
}

/** Busca produtos similares via RPC bidirecional → grupos → fornecedor/categoria (3 níveis). */
export function useSimilarProducts(product: Product | null | undefined) {
  const productId = product?.id;
  const supplierId = product?.supplier?.id;
  const categoryId = product?.category_id;

  return useQuery<SimilarProductItem[]>({
    queryKey: ['similar-products', productId],
    queryFn: async () => {
      if (!productId) return [];

      // ── Nível 1: fn_get_similar_products (BIDIRECIONAL via RPC) ──────────────
      // Corrige o gap onde produtos só em related_product_id nunca apareciam.
      // Verifica AMBAS as direções: product_id = X  e  related_product_id = X.
      try {
        const { data: rpcRows, error: rpcErr } = await supabase.rpc(
          'fn_get_similar_products',
          { p_product_id: productId, p_limit: 50 }
        );

        if (rpcErr) throw rpcErr;

        if (rpcRows && rpcRows.length > 0) {
          const relatedIds = (rpcRows as Array<{ similar_product_id: string; direction: string }>)
            .map((r) => r.similar_product_id)
            .filter(Boolean);

          const items = await fetchProductsByIds(relatedIds);
          if (items.length > 0) return items;
        }
      } catch (err) {
        // Fallback para query direta (compatibilidade retroativa)
        logger.warn('[useSimilarProducts] RPC fn_get_similar_products failed, trying direct query:', err);
        try {
          const { records: relationships } = await dbInvoke<{
            related_product_id: string;
          }>({
            table: 'product_relationships',
            operation: 'select',
            select: 'related_product_id',
            filters: {
              product_id: productId,
              relationship_type: 'similar',
            },
            limit: 50,
          });

          if (relationships && relationships.length > 0) {
            const relatedIds = relationships.map((r) => r.related_product_id);
            const items = await fetchProductsByIds(relatedIds);
            if (items.length > 0) return items;
          }
        } catch (fallbackErr) {
          logger.warn('[useSimilarProducts] Direct query fallback also failed:', fallbackErr);
        }
      }

      // ── Nível 2: product_group_members (group-based siblings) ────────────────
      try {
        const { records: memberships } = await dbInvoke<{
          product_group_id: string;
        }>({
          table: 'product_group_members',
          operation: 'select',
          select: 'product_group_id',
          filters: { product_id: productId },
          limit: 10,
        });

        if (memberships && memberships.length > 0) {
          const groupIds = [...new Set(memberships.map((m) => m.product_group_id))].filter(Boolean);
          if (groupIds.length === 0) throw new Error('No valid group IDs');

          const { records: allMembers } = await dbInvoke<{
            product_id: string;
          }>({
            table: 'product_group_members',
            operation: 'select',
            select: 'product_id',
            filters: {
              product_group_id: groupIds,
            },
            limit: 100,
          });

          const siblingIds = [
            ...new Set(
              (allMembers || []).map((m) => m.product_id).filter((id) => id !== productId),
            ),
          ];

          if (siblingIds.length > 0) {
            const items = await fetchProductsByIds(siblingIds);
            if (items.length > 0) return items;
          }
        }
      } catch (err) {
        logger.warn(
          '[useSimilarProducts] product_group_members query failed, using fallback:',
          err,
        );
      }

      // ── Nível 3: Fallback por fornecedor/categoria ───────────────────────────
      try {
        const fallbackFilters: Record<string, unknown> = { active: true };
        if (supplierId && supplierId !== 'unknown') {
          fallbackFilters.supplier_id = supplierId;
        } else if (categoryId) {
          fallbackFilters.main_category_id = categoryId;
        }

        const { records: fallbackProducts } = await dbInvoke<LightweightProduct>({
          table: 'products',
          operation: 'select',
          select: SIMILAR_PRODUCT_SELECT,
          filters: fallbackFilters,
          limit: 30,
          orderBy: { column: 'name', ascending: true },
        });

        return (fallbackProducts || [])
          .filter((p) => p.id !== productId && p.sale_price > 0)
          .map(mapLightweightToSimilarItem);
      } catch (err) {
        logger.warn('[useSimilarProducts] Fallback query failed:', err);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!product,
  });
}
