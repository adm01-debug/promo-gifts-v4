import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchPromobrindProducts, fetchPromobrindCategories } from '@/lib/external-db';
import type { FilterKey } from '@/hooks/intelligence/useZeroResultDiagnosis';

export interface Substitute {
  id: string;
  name: string;
  /** Nº de orçamentos que voltariam ao aplicar este substituto (na mesma janela). */
  quotes: number;
  /** Nº de pedidos que voltariam ao aplicar este substituto. */
  orders: number;
  /** Score combinado usado para ranking (pedidos pesam 2x). */
  score: number;
}

export interface ZeroResultSubstitutes {
  categories: Substitute[];
  suppliers: Substitute[];
  products: Substitute[];
}

interface Params {
  enabled: boolean;
  days: number;
  categoryId?: string | null;
  supplierId?: string | null;
  productId?: string | null;
  culprit: FilterKey | 'intersection' | 'window' | null;
  /** Quantos substitutos ranqueados retornar por eixo. */
  limit?: number;
}

const getSince = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

const SAMPLE_SIZE = 800;
const ENRICH_LIMIT = 250;

/** Agrega scores por chave, somando ao valor existente. */
function accumulate(
  target: Map<string, { quotes: number; orders: number }>,
  key: string | null | undefined,
  bucket: 'quotes' | 'orders',
  add = 1,
) {
  if (!key) return;
  const cur = target.get(key) ?? { quotes: 0, orders: 0 };
  cur[bucket] += add;
  target.set(key, cur);
}

/**
 * Recomenda categorias/fornecedores/produtos SUBSTITUTOS (ranqueados por
 * atividade real no Gold) para recuperar resultados quando o filtro atual zera.
 *
 * Estratégia:
 *  1. Amostra últimas ~800 linhas de quote_items e order_items na janela;
 *  2. Enriquece os product_ids via bridge (categoria + fornecedor);
 *  3. Agrega score = orçamentos + 2×pedidos por dimensão;
 *  4. Exclui os valores atualmente aplicados (para não recomendar o mesmo);
 *  5. Retorna Top-N por dimensão relevante ao culprit.
 *
 * NÃO dispara quando `culprit === 'window'` (não há dados na janela).
 */
export function useZeroResultSubstitutes({
  enabled,
  days,
  categoryId,
  supplierId,
  productId,
  culprit,
  limit = 5,
}: Params) {
  const active = enabled && !!culprit && culprit !== 'window';

  return useQuery<ZeroResultSubstitutes>({
    enabled: active,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryKey: [
      'intelligence-zero-substitutes',
      days,
      categoryId ?? null,
      supplierId ?? null,
      productId ?? null,
      culprit,
      limit,
    ],
    queryFn: async () => {
      const since = getSince(days);

      // 1. Amostra atividade recente ------------------------------------------
      const [{ data: qi }, { data: oi }] = await Promise.all([
        supabase
          .from('quote_items')
          .select('product_id')
          .gte('created_at', since)
          .not('product_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(SAMPLE_SIZE),
        supabase
          .from('order_items')
          .select('product_id')
          .gte('created_at', since)
          .not('product_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(SAMPLE_SIZE),
      ]);

      const perProduct = new Map<string, { quotes: number; orders: number }>();
      (qi ?? []).forEach((r) => accumulate(perProduct, r.product_id as string, 'quotes'));
      (oi ?? []).forEach((r) => accumulate(perProduct, r.product_id as string, 'orders'));

      const productIds = Array.from(perProduct.keys()).slice(0, ENRICH_LIMIT);
      if (productIds.length === 0) {
        return { categories: [], suppliers: [], products: [] };
      }

      // 2. Enriquece produtos e categorias -----------------------------------
      const [products, categories] = await Promise.all([
        fetchPromobrindProducts({ limit: productIds.length, filters: { id: productIds } }),
        fetchPromobrindCategories().catch(() => [] as { id: string; name: string }[]),
      ]);
      const catNameById = new Map(categories.map((c) => [c.id, c.name] as const));

      const perCategory = new Map<string, { quotes: number; orders: number }>();
      const perSupplier = new Map<string, { quotes: number; orders: number }>();
      const supplierNameById = new Map<string, string>();
      const productMetaById = new Map<
        string,
        { name: string; categoryId: string | null; supplierId: string | null }
      >();

      for (const p of products) {
        const score = perProduct.get(p.id);
        if (!score) continue;
        productMetaById.set(p.id, {
          name: p.name,
          categoryId: p.category_id ?? p.main_category_id ?? null,
          supplierId: p.supplier_id ?? null,
        });

        const catId = p.category_id ?? p.main_category_id;
        if (catId) {
          const cur = perCategory.get(catId) ?? { quotes: 0, orders: 0 };
          perCategory.set(catId, {
            quotes: cur.quotes + score.quotes,
            orders: cur.orders + score.orders,
          });
        }
        if (p.supplier_id) {
          const cur = perSupplier.get(p.supplier_id) ?? { quotes: 0, orders: 0 };
          perSupplier.set(p.supplier_id, {
            quotes: cur.quotes + score.quotes,
            orders: cur.orders + score.orders,
          });
          if (p.brand) supplierNameById.set(p.supplier_id, p.brand);
        }
      }

      const toRanked = (
        m: Map<string, { quotes: number; orders: number }>,
        nameFor: (id: string) => string | undefined,
        excludeId: string | null | undefined,
      ): Substitute[] =>
        Array.from(m.entries())
          .filter(([id, v]) => id !== excludeId && v.quotes + v.orders > 0)
          .map(([id, v]) => ({
            id,
            name: nameFor(id) ?? id,
            quotes: v.quotes,
            orders: v.orders,
            score: v.quotes + v.orders * 2,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);

      // 3. Filtra dimensões conforme o culpado -------------------------------
      const wantCategory = culprit === 'category' || culprit === 'intersection';
      const wantSupplier = culprit === 'supplier' || culprit === 'intersection';
      const wantProduct = culprit === 'product' || culprit === 'intersection';

      const categoriesRanked = wantCategory
        ? toRanked(perCategory, (id) => catNameById.get(id), categoryId)
        : [];
      const suppliersRanked = wantSupplier
        ? toRanked(perSupplier, (id) => supplierNameById.get(id), supplierId)
        : [];
      const productsRanked = wantProduct
        ? Array.from(perProduct.entries())
            .filter(([id, v]) => {
              if (id === productId) return false;
              if (v.quotes + v.orders === 0) return false;
              const meta = productMetaById.get(id);
              // Se há filtro de categoria ativo, prioriza produtos dessa mesma categoria
              if (categoryId && meta && meta.categoryId !== categoryId) return false;
              if (supplierId && meta && meta.supplierId !== supplierId) return false;
              return !!meta; // exige metadata para exibir nome legível
            })
            .map(([id, v]) => {
              const meta = productMetaById.get(id)!;
              return {
                id,
                name: meta.name,
                quotes: v.quotes,
                orders: v.orders,
                score: v.quotes + v.orders * 2,
              };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
        : [];

      return {
        categories: categoriesRanked,
        suppliers: suppliersRanked,
        products: productsRanked,
      };
    },
  });
}
