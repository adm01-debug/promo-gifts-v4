/**
 * useClientVsIndustry — compara métricas do cliente com a média do seu ramo.
 * Resolve company IDs do mesmo ramo (excluindo o próprio), chama RPC de benchmark,
 * calcula deltas e classificação. Fallback mock quando amostra insuficiente.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectCrm } from '@/lib/crm-db';
import { useClientBI } from '@/hooks/bi/useClientBI';
import { isDemoClient } from '@/lib/bi/demoClient';
import type { CrmCompany } from '@/types/crm';

export type ComparisonClassification = 'above' | 'below' | 'no_data' | 'on_par';

export interface MetricComparison {
  label: string;
  clientValue: number;
  industryAvg: number;
  deltaPercent: number;
  classification: ComparisonClassification;
  format: 'currency' | 'number';
}

export interface ClientVsIndustryResult {
  isLoading: boolean;
  isMock: boolean;
  hasEnoughSample: boolean;
  sampleSize: number;
  daysWindow: number;
  metrics: MetricComparison[];
  insight: string | null;
}

const THRESHOLD = 15; // ±15% = "na média"
const MIN_SAMPLE = 3;
const DAYS_WINDOW = 180;

function classify(deltaPct: number): ComparisonClassification {
  if (Math.abs(deltaPct) <= THRESHOLD) return 'on_par';
  return deltaPct > 0 ? 'above' : 'below';
}

function pctDelta(client: number, industry: number): number {
  if (!industry || industry <= 0) return 0;
  return ((client - industry) / industry) * 100;
}

function buildInsight(metrics: MetricComparison[]): string | null {
  const ticket = metrics.find((m) => m.label === 'Ticket médio');
  const ltv = metrics.find((m) => m.label === 'LTV');
  const freq = metrics.find((m) => m.label === 'Frequência (pedidos)');

  if (ticket && ticket.classification === 'above' && ticket.deltaPercent >= 25) {
    return `Este cliente compra ${Math.round(ticket.deltaPercent)}% mais por pedido que a média do setor — bom alvo para upsell premium.`;
  }
  if (ltv && ltv.classification === 'below' && ltv.deltaPercent <= -25) {
    return `LTV ${Math.abs(Math.round(ltv.deltaPercent))}% abaixo da média do ramo — potencial de crescimento via cross-sell.`;
  }
  if (freq && freq.classification === 'above' && freq.deltaPercent >= 30) {
    return `Cliente compra ${Math.round(freq.deltaPercent)}% mais frequentemente que o setor — cultive a recorrência com programas de fidelidade.`;
  }
  if (freq && freq.classification === 'below' && freq.deltaPercent <= -30) {
    return `Frequência ${Math.abs(Math.round(freq.deltaPercent))}% abaixo do setor — oportunidade clara de reativação.`;
  }
  const allOnPar = metrics.every(
    (m) => m.classification === 'on_par' || m.classification === 'no_data',
  );
  if (allOnPar) {
    return 'Cliente alinhado à média do setor em todas as métricas — performance saudável e estável.';
  }
  return null;
}

interface BenchmarkRow {
  total_clients_sampled: number;
  avg_ltv: number;
  avg_ticket: number;
  avg_quotes_per_client: number;
  avg_items_per_quote: number;
  top_product_name: string | null;
  total_revenue: number;
}

export function useClientVsIndustry(
  clientId: string | null | undefined,
  ramoAtividade: string | null | undefined,
): ClientVsIndustryResult {
  const clientBI = useClientBI(clientId ?? undefined);

  const benchmarkQuery = useQuery({
    queryKey: ['bi', 'industry-benchmark', ramoAtividade, clientId],
    enabled: !!ramoAtividade && !!clientId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Demo: retorna benchmark mockado plausível
      if (isDemoClient(clientId)) {
        const mockRow: BenchmarkRow = {
          total_clients_sampled: 24,
          avg_ltv: 38500,
          avg_ticket: 2850,
          avg_quotes_per_client: 11,
          avg_items_per_quote: 2.4,
          top_product_name: 'Garrafa Térmica Inox 500ml',
          total_revenue: 924000,
        };
        return { rows: [mockRow], sampleSize: 24 };
      }

      if (!ramoAtividade) {
        return { rows: [] as BenchmarkRow[], sampleSize: 0 };
      }

      // 1) Resolver IDs de empresas do mesmo ramo, excluindo o próprio cliente
      const companies = await selectCrm<Pick<CrmCompany, 'id'>>('companies', {
        select: 'id',
        filters: { ramo_atividade: ramoAtividade, deleted_at: null },
        limit: 500,
      });
      const ids = companies.map((c) => c.id).filter((id) => id && id !== clientId);

      if (ids.length === 0) {
        return { rows: [] as BenchmarkRow[], sampleSize: 0 };
      }

      const { data, error } = await supabase.rpc('get_industry_benchmark_stats', {
        _company_ids: ids,
        _days: DAYS_WINDOW,
      });
      if (error) throw error;
      return { rows: (data ?? []) as BenchmarkRow[], sampleSize: ids.length };
    },
  });

  const isLoading = clientBI.isLoading || benchmarkQuery.isLoading;
  const benchmark = benchmarkQuery.data?.rows?.[0];
  const sampleSize = Number(benchmark?.total_clients_sampled ?? 0);
  const hasEnoughSample = sampleSize >= MIN_SAMPLE;

  if (!benchmark || !hasEnoughSample) {
    return {
      isLoading,
      isMock: true,
      hasEnoughSample: false,
      sampleSize,
      daysWindow: DAYS_WINDOW,
      metrics: [],
      insight: null,
    };
  }

  // Estimativa: itens/orçamento do cliente — sem RPC dedicada, derivamos de recentOrders
  const clientAvgItems = clientBI.recentOrders.length
    ? clientBI.recentOrders.reduce((s, o) => s + (o.itemsCount ?? 1), 0) /
      clientBI.recentOrders.length
    : 0;

  const metrics: MetricComparison[] = [
    {
      label: 'LTV',
      clientValue: clientBI.ltv,
      industryAvg: Number(benchmark.avg_ltv),
      deltaPercent: pctDelta(clientBI.ltv, Number(benchmark.avg_ltv)),
      classification: classify(pctDelta(clientBI.ltv, Number(benchmark.avg_ltv))),
      format: 'currency',
    },
    {
      label: 'Ticket médio',
      clientValue: clientBI.avgTicket,
      industryAvg: Number(benchmark.avg_ticket),
      deltaPercent: pctDelta(clientBI.avgTicket, Number(benchmark.avg_ticket)),
      classification: classify(pctDelta(clientBI.avgTicket, Number(benchmark.avg_ticket))),
      format: 'currency',
    },
    {
      label: 'Frequência (pedidos)',
      clientValue: clientBI.ordersCount,
      industryAvg: Number(benchmark.avg_quotes_per_client),
      deltaPercent: pctDelta(clientBI.ordersCount, Number(benchmark.avg_quotes_per_client)),
      classification: classify(
        pctDelta(clientBI.ordersCount, Number(benchmark.avg_quotes_per_client)),
      ),
      format: 'number',
    },
    {
      label: 'Itens por orçamento',
      clientValue: clientAvgItems,
      industryAvg: Number(benchmark.avg_items_per_quote),
      deltaPercent: pctDelta(clientAvgItems, Number(benchmark.avg_items_per_quote)),
      classification: classify(pctDelta(clientAvgItems, Number(benchmark.avg_items_per_quote))),
      format: 'number',
    },
  ];

  return {
    isLoading,
    isMock: clientBI.isMock,
    hasEnoughSample: true,
    sampleSize,
    daysWindow: DAYS_WINDOW,
    metrics,
    insight: buildInsight(metrics),
  };
}
