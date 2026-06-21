/**
 * stockKpiCards — Helper puro que define os KPIs do dashboard de estoque.
 *
 * Mantém o mapeamento `summary → cards` fora do componente para permitir
 * teste unitário (sem providers, sem React Query) e garantir que cada card
 * use a contagem certa (variações vs produtos) e o filtro correto.
 */
import type { StockDashboardSummary, StockStatusFilter } from '@/types/stock';

export type StockKpiSlug =
  | 'total-de-variacoes'
  | 'em-estoque'
  | 'critico'
  | 'sem-estoque';

export interface StockKpiCardData {
  slug: StockKpiSlug;
  title: string;
  /** Unidade contábil do card (para tooltip / leitor de tela). */
  unit: 'variações' | 'produtos';
  value: number;
  /** Texto curto mostrado abaixo do número (clareza imediata). */
  subtitle: string;
  /** Tooltip detalhado (atributo title nativo). */
  tooltip: string;
  /** Filtro aplicado ao clicar; null = limpar filtro. */
  filter: StockStatusFilter | null;
  variant: 'default' | 'success' | 'warning' | 'error';
}

const pct = (n: number, total: number): string =>
  total > 0 ? `${Math.round((n / total) * 100)}%` : '0%';

/**
 * Constrói os 4 cards principais a partir de um summary já agregado.
 * Todos os valores primários são em granularidade de VARIAÇÃO (cor/tamanho)
 * — o número que importa para o vendedor decidir vender ou não.
 */
export function buildStockKpiCards(summary: StockDashboardSummary): StockKpiCardData[] {
  const { totalVariants, totalProducts, variantsInStock, variantsCritical, variantsOutOfStock } =
    summary;

  return [
    {
      slug: 'total-de-variacoes',
      title: 'Total de Variações',
      unit: 'variações',
      value: totalVariants,
      subtitle: `em ${totalProducts.toLocaleString('pt-BR')} produtos`,
      tooltip:
        `${totalVariants.toLocaleString('pt-BR')} variações (cor/tamanho) distribuídas ` +
        `em ${totalProducts.toLocaleString('pt-BR')} produtos.`,
      filter: 'all',
      variant: 'default',
    },
    {
      slug: 'em-estoque',
      title: 'Em Estoque',
      unit: 'variações',
      value: variantsInStock,
      subtitle: `${pct(variantsInStock, totalVariants)} das variações`,
      tooltip:
        `${variantsInStock.toLocaleString('pt-BR')} variações disponíveis para venda ` +
        `(de ${totalVariants.toLocaleString('pt-BR')} totais).`,
      filter: 'in_stock',
      variant: 'success',
    },
    {
      slug: 'critico',
      title: 'Crítico',
      unit: 'variações',
      value: variantsCritical,
      subtitle: `${pct(variantsCritical, totalVariants)} das variações`,
      tooltip:
        `${variantsCritical.toLocaleString('pt-BR')} variações em estado crítico ` +
        `(estoque baixo / abaixo do mínimo).`,
      filter: 'critical',
      variant: 'warning',
    },
    {
      slug: 'sem-estoque',
      title: 'Sem Estoque',
      unit: 'variações',
      value: variantsOutOfStock,
      subtitle:
        variantsOutOfStock > 0
          ? `em ${summary.productsOutOfStock.toLocaleString('pt-BR')} produtos afetados`
          : 'nenhuma variação zerada',
      tooltip:
        `${variantsOutOfStock.toLocaleString('pt-BR')} variações esgotadas, ` +
        `afetando ${summary.productsOutOfStock.toLocaleString('pt-BR')} produtos.`,
      filter: 'out_of_stock',
      variant: 'error',
    },
  ];
}
