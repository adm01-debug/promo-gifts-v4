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
      const widenedDays = Math.min(365, Math.max(days * 2, days + 30));
      const sinceWidened = getSince(widenedDays);

      // Resolve IDs uma única vez por combinação leave-one-out (economiza roundtrips)
      const [catIds, supIds, prodIds] = await Promise.all([
        categoryId ? resolveProductIds(null, supplierId, productId) : Promise.resolve(null),
        supplierId ? resolveProductIds(categoryId, null, productId) : Promise.resolve(null),
        productId ? resolveProductIds(categoryId, supplierId, null) : Promise.resolve(null),
      ]);

      const [
        unfilteredQuoteCount,
        unfilteredOrderCount,
        catProbeQ,
        supProbeQ,
        prodProbeQ,
        catProbeO,
        supProbeO,
        prodProbeO,
        widenedQuotes,
        widenedOrders,
      ] = await Promise.all([
        countQuotesInWindow(since, null),
        countOrdersInWindow(since, null),
        categoryId ? countQuotesInWindow(since, catIds) : Promise.resolve<number | null>(null),
        supplierId ? countQuotesInWindow(since, supIds) : Promise.resolve<number | null>(null),
        productId ? countQuotesInWindow(since, prodIds) : Promise.resolve<number | null>(null),
        categoryId ? countOrdersInWindow(since, catIds) : Promise.resolve<number | null>(null),
        supplierId ? countOrdersInWindow(since, supIds) : Promise.resolve<number | null>(null),
        productId ? countOrdersInWindow(since, prodIds) : Promise.resolve<number | null>(null),
        countQuotesInWindow(sinceWidened, null),
        countOrdersInWindow(sinceWidened, null),
      ]);

      const leaveOneOut: Record<FilterKey, number | null> = {
        category: catProbeQ,
        supplier: supProbeQ,
        product: prodProbeQ,
      };
      const leaveOneOutOrders: Record<FilterKey, number | null> = {
        category: catProbeO,
        supplier: supProbeO,
        product: prodProbeO,
      };

      // "Positivo" combina orçamentos + pedidos — qualquer sinal destrava o filtro
      const combined: Array<[FilterKey, number]> = (Object.keys(leaveOneOut) as FilterKey[]).map(
        (k) => [k, (leaveOneOut[k] ?? 0) + (leaveOneOutOrders[k] ?? 0)],
      );
      const positive = combined
        .filter(([k, v]) => v > 0 && (leaveOneOut[k] !== null || leaveOneOutOrders[k] !== null))
        .sort((a, b) => b[1] - a[1]);

      const activeFilters: Array<{ key: FilterKey; label: string }> = [];
      if (productId) activeFilters.push({ key: 'product', label: productName ?? 'Produto' });
      if (supplierId) activeFilters.push({ key: 'supplier', label: supplierName ?? 'Fornecedor' });
      if (categoryId) activeFilters.push({ key: 'category', label: categoryName ?? 'Categoria' });

      let culprit: ZeroResultDiagnosis['culprit'] = null;
      let filtersToWiden: Array<{ key: FilterKey; label: string }> = [];

      const totalBaseline = unfilteredQuoteCount + unfilteredOrderCount;
      if (totalBaseline === 0) {
        culprit = 'window';
      } else if (positive.length === 1) {
        const [key] = positive[0];
        culprit = key;
        filtersToWiden = activeFilters.filter((f) => f.key === key);
      } else if (positive.length > 1) {
        culprit = 'intersection';
        filtersToWiden = positive
          .map(([key]) => activeFilters.find((f) => f.key === key)!)
          .filter(Boolean);
      } else if (activeFilters.length > 0) {
        culprit = 'intersection';
        filtersToWiden = activeFilters;
      }

      const widenedPreview =
        culprit === 'window'
          ? { days: widenedDays, quotes: widenedQuotes, orders: widenedOrders }
          : null;

      return {
        unfilteredQuoteCount,
        unfilteredOrderCount,
        leaveOneOut,
        leaveOneOutOrders,
        widenedPreview,
        culprit,
        filtersToWiden,
      };
    },
  });
}
