import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type FilterKey = 'category' | 'supplier' | 'product';

export interface LeaveOneOutPreview {
  quotes: number | null;
  orders: number | null;
}

export interface ZeroResultDiagnosis {
  /** Contagem de orçamentos no Gold, sem qualquer filtro de produto/categoria/fornecedor. */
  unfilteredQuoteCount: number;
  /** Contagem de pedidos no Gold, sem qualquer filtro. */
  unfilteredOrderCount: number;
  /** Contagem de orçamentos que APARECERIA se cada filtro fosse removido (leave-one-out). */
  leaveOneOut: Record<FilterKey, number | null>;
  /** Contagem de pedidos que APARECERIA se cada filtro fosse removido (leave-one-out). */
  leaveOneOutOrders: Record<FilterKey, number | null>;
  /** Prévia dos totais ao ampliar a janela (dobra a janela, teto 365d). */
  widenedPreview: { days: number; quotes: number; orders: number } | null;
  /** Filtro apontado como culpado (o único que, quando removido, destrava resultados). */
  culprit: FilterKey | 'intersection' | 'window' | null;
  /** Rótulos legíveis dos filtros que devem ser ampliados. */
  filtersToWiden: Array<{ key: FilterKey; label: string }>;
}

interface Params {
  enabled: boolean;
  days: number;
  categoryId?: string | null;
  supplierId?: string | null;
  productId?: string | null;
  categoryName?: string | null;
  supplierName?: string | null;
  productName?: string | null;
}

const getSince = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

/**
 * Conta orçamentos (proxy de "atividade comercial") na janela, opcionalmente
 * restringido a um conjunto de product_ids. Usa `count: 'exact', head: true`
 * (sem payload) para ser barato mesmo em bases grandes.
 */
async function countQuotesInWindow(
  sinceIso: string,
  productIds: string[] | null,
): Promise<number> {
  if (productIds && productIds.length === 0) return 0;

  if (!productIds) {
    const { count } = await supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sinceIso);
    return count ?? 0;
  }

  // quote_items.product_id — limita a 200 ids p/ não estourar querystring
  const { count } = await supabase
    .from('quote_items')
    .select('quote_id', { count: 'exact', head: true })
    .gte('created_at', sinceIso)
    .in('product_id', productIds.slice(0, 200));
  return count ?? 0;
}

/**
 * Conta pedidos (orders) na janela, opcionalmente restringido a product_ids
 * via order_items. Mesmo padrão de countQuotesInWindow.
 */
async function countOrdersInWindow(
  sinceIso: string,
  productIds: string[] | null,
): Promise<number> {
  if (productIds && productIds.length === 0) return 0;

  if (!productIds) {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sinceIso);
    return count ?? 0;
  }

  const { count } = await supabase
    .from('order_items')
    .select('order_id', { count: 'exact', head: true })
    .gte('created_at', sinceIso)
    .in('product_id', productIds.slice(0, 200));
  return count ?? 0;
}

async function resolveProductIds(
  categoryId?: string | null,
  supplierId?: string | null,
  productId?: string | null,
): Promise<string[] | null> {
  if (productId) return [productId];
  if (!categoryId && !supplierId) return null;
  const { fetchPromobrindProducts } = await import('@/lib/external-db');
  const filters: Record<string, unknown> = {};
  if (categoryId) filters.category_id = categoryId;
  if (supplierId) filters.supplier_id = supplierId;
  const products = await fetchPromobrindProducts({ limit: 5000, filters });
  return products.map((p) => p.id);
}

/**
 * Diagnostica por que o painel de Inteligência retornou zero e aponta qual
 * filtro (categoria/fornecedor/produto) está bloqueando resultados.
 *
 * Estratégia leave-one-out: para cada filtro ativo, refaz a busca com esse
 * filtro removido (mantendo os demais) e conta orçamentos na janela.
 * — Se algum leave-one-out > 0: aquele filtro é o gargalo.
 * — Se todos = 0 mas `unfilteredQuoteCount` > 0: a intersecção dos filtros está vazia.
 * — Se `unfilteredQuoteCount` = 0: a janela em dias é o gargalo (nada foi vendido).
 */
export function useZeroResultDiagnosis({
  enabled,
  days,
  categoryId,
  supplierId,
  productId,
  categoryName,
  supplierName,
  productName,
}: Params) {
  return useQuery<ZeroResultDiagnosis>({
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryKey: [
      'intelligence-zero-diagnosis',
      days,
      categoryId ?? null,
      supplierId ?? null,
      productId ?? null,
    ],
    queryFn: async () => {
      const since = getSince(days);

      const [unfilteredQuoteCount, catProbe, supProbe, prodProbe] = await Promise.all([
        // Baseline: houve algum orçamento na janela, sem qualquer filtro?
        countQuotesInWindow(since, null),
        // Leave-one-out categoria (mantém supplier + product)
        categoryId
          ? resolveProductIds(null, supplierId, productId).then((ids) =>
              countQuotesInWindow(since, ids),
            )
          : Promise.resolve<number | null>(null),
        // Leave-one-out fornecedor (mantém category + product)
        supplierId
          ? resolveProductIds(categoryId, null, productId).then((ids) =>
              countQuotesInWindow(since, ids),
            )
          : Promise.resolve<number | null>(null),
        // Leave-one-out produto (mantém category + supplier)
        productId
          ? resolveProductIds(categoryId, supplierId, null).then((ids) =>
              countQuotesInWindow(since, ids),
            )
          : Promise.resolve<number | null>(null),
      ]);

      const leaveOneOut: Record<FilterKey, number | null> = {
        category: catProbe,
        supplier: supProbe,
        product: prodProbe,
      };

      const positive = (Object.entries(leaveOneOut) as [FilterKey, number | null][])
        .filter(([, v]) => v !== null && v > 0)
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

      const activeFilters: Array<{ key: FilterKey; label: string }> = [];
      if (productId) activeFilters.push({ key: 'product', label: productName ?? 'Produto' });
      if (supplierId) activeFilters.push({ key: 'supplier', label: supplierName ?? 'Fornecedor' });
      if (categoryId) activeFilters.push({ key: 'category', label: categoryName ?? 'Categoria' });

      let culprit: ZeroResultDiagnosis['culprit'] = null;
      let filtersToWiden: Array<{ key: FilterKey; label: string }> = [];

      if (unfilteredQuoteCount === 0) {
        culprit = 'window';
      } else if (positive.length === 1) {
        const [key] = positive[0];
        culprit = key;
        filtersToWiden = activeFilters.filter((f) => f.key === key);
      } else if (positive.length > 1) {
        // Mais de um filtro, se removido, destrava resultados — intersecção estreita
        culprit = 'intersection';
        filtersToWiden = positive.map(([key]) => activeFilters.find((f) => f.key === key)!).filter(Boolean);
      } else if (activeFilters.length > 0) {
        // Todos leave-one-out = 0 mas há baseline — intersecção vazia
        culprit = 'intersection';
        filtersToWiden = activeFilters;
      }

      return { unfilteredQuoteCount, leaveOneOut, culprit, filtersToWiden };
    },
  });
}
