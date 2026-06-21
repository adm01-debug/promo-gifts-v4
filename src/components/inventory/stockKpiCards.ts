/**
 * stockKpiCards — Helper puro que define os KPIs do dashboard de estoque.
 *
 * Mantém o mapeamento `summary → cards` fora do componente para permitir
 * teste unitário (sem providers, sem React Query) e garantir que cada card
 * use a contagem certa (variações vs produtos) e o filtro correto.
 */
import type { StockDashboardSummary } from '@/types/stock';

export type StockKpiFilter = 'all' | 'in_stock' | 'critical' | 'out_of_stock';


export type StockKpiSlug =
  | 'total-de-variacoes'
  | 'em-estoque'
  | 'risco-de-ruptura'
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
  filter: StockKpiFilter | null;
  variant: 'default' | 'success' | 'warning' | 'error';
}

const pct = (n: number, total: number): string =>
  total > 0 ? `${Math.round((n / total) * 100)}%` : '0%';

/**
 * Constrói os 4 cards principais a partir de um summary já agregado.
 * Todos os valores primários são em granularidade de VARIAÇÃO (cor/tamanho)
 * — o número que importa para o vendedor decidir vender ou não.
 *
 * @param ruptureRisk30dCount variações com cobertura ≤ 30 dias (vindo de
 *   `mv_stock_rupture_alert`). Quando omitido (flag EMA off), o card "Risco
 *   de Ruptura" cai no fallback `variantsCritical` (estado atual) para não
 *   ficar vazio.
 */
export function buildStockKpiCards(
  summary: StockDashboardSummary,
  ruptureRisk30dCount?: number | null,
): StockKpiCardData[] {
  const { totalVariants, totalProducts, variantsInStock, variantsCritical, variantsOutOfStock } =
    summary;

  const ruptureValue =
    typeof ruptureRisk30dCount === 'number' && Number.isFinite(ruptureRisk30dCount)
      ? ruptureRisk30dCount
      : variantsCritical;
  const ruptureFromEma = typeof ruptureRisk30dCount === 'number';


  return [
    {
      slug: 'total-de-variacoes',
      title: 'Total de Variações',
      unit: 'variações',
      value: totalVariants,
      subtitle: `em ${totalProducts.toLocaleString('pt-BR')} produtos`,
      tooltip: 'Todas as variações (cor/tamanho) do catálogo. Use para dimensionar o mix.',
      filter: 'all',
      variant: 'default',
    },
    {
      slug: 'em-estoque',
      title: 'Em Estoque',
      unit: 'variações',
      value: variantsInStock,
      subtitle: `${pct(variantsInStock, totalVariants)} das variações`,
      tooltip: 'Variações disponíveis para venda imediata.',
      filter: 'in_stock',
      variant: 'success',
    },
    {
      slug: 'risco-de-ruptura',
      title: 'Risco de Ruptura',
      unit: 'variações',
      value: ruptureValue,
      subtitle: ruptureFromEma
        ? 'podem esgotar em até 30 dias'
        : `${pct(ruptureValue, totalVariants)} em estado crítico`,
      tooltip: ruptureFromEma
        ? 'Análise Preditiva. Variações com previsão de zerar o estoque em até 30 dias.'
        : 'Variações em estado crítico. Atenção ao oferecer.',
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
      tooltip: 'Variações zeradas. Evite ofertar ou confirme reposição antes.',
      filter: 'out_of_stock',
      variant: 'error',
    },
  ];
}

