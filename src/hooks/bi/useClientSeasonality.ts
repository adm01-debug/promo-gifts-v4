/**
 * useClientSeasonality — sazonalidade Cliente × Setor (12 meses).
 * Combina RPC do cliente + RPC do setor (empresas mesmo ramo).
 * Calcula: distribuição mensal, top 3 picos, próximo pico, insight textual.
 * Fallback mock determinístico se < 3 meses com dados.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectCrm } from '@/lib/crm-db';
import { getMockSeasonality } from '@/lib/bi/mockData';

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];
const MONTH_LABELS_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export interface ClientMonthCell {
  month: number; // 1-12
  monthLabel: string;
  quotesCount: number;
  totalRevenue: number;
  avgTicket: number;
  sharePercent: number; // % do total anual do cliente
  intensity: number; // 0..1 normalizado pelo maior mês do cliente
}

export interface IndustryMonthCell {
  month: number;
  monthLabel: string;
  avgQuotesPerCompany: number;
  avgRevenuePerCompany: number;
  sharePercent: number;
  intensity: number;
}

export interface SeasonalityResult {
  isLoading: boolean;
  isMock: boolean;
  hasEnoughData: boolean;
  monthsCovered: number;
  windowMonths: number;
  client: ClientMonthCell[]; // sempre 12 posições, Jan→Dez
  industry: IndustryMonthCell[]; // sempre 12 posições
  topClientMonths: ClientMonthCell[]; // top 3
  topIndustryMonths: IndustryMonthCell[]; // top 3
  nextPeakMonth: number | null; // 1-12
  daysToNextPeak: number | null;
  insight: string | null;
}

interface ClientRow {
  year: number;
  month: number;
  quotes_count: number;
  total_revenue: number;
  avg_ticket: number;
}
interface IndustryRow {
  year: number;
  month: number;
  avg_quotes_per_company: number;
  avg_revenue_per_company: number;
  companies_active: number;
}

const WINDOW_MONTHS = 24;

function buildClientCells(rows: ClientRow[]): {
  cells: ClientMonthCell[];
  monthsCovered: number;
} {
  // Acumula por mês (1..12) somando os 24 meses
  const acc: Record<number, { q: number; r: number; t: number; n: number }> = {};
  const monthsSet = new Set<string>();
  for (const r of rows) {
    monthsSet.add(`${r.year}-${r.month}`);
    const m = r.month;
    if (!acc[m]) acc[m] = { q: 0, r: 0, t: 0, n: 0 };
    acc[m].q += Number(r.quotes_count) || 0;
    acc[m].r += Number(r.total_revenue) || 0;
    acc[m].t += Number(r.avg_ticket) || 0;
    acc[m].n += 1;
  }
  const totalQuotes = Object.values(acc).reduce((s, v) => s + v.q, 0);
  const maxQuotes = Math.max(0, ...Object.values(acc).map((v) => v.q));

  const cells: ClientMonthCell[] = [];
  for (let m = 1; m <= 12; m++) {
    const v = acc[m];
    const q = v?.q ?? 0;
    cells.push({
      month: m,
      monthLabel: MONTH_LABELS[m - 1],
      quotesCount: q,
      totalRevenue: v?.r ?? 0,
      avgTicket: v?.n ? v.t / v.n : 0,
      sharePercent: totalQuotes > 0 ? (q / totalQuotes) * 100 : 0,
      intensity: maxQuotes > 0 ? q / maxQuotes : 0,
    });
  }
  return { cells, monthsCovered: monthsSet.size };
}

function buildIndustryCells(rows: IndustryRow[]): IndustryMonthCell[] {
  const acc: Record<number, { q: number; r: number; n: number }> = {};
  for (const r of rows) {
    const m = r.month;
    if (!acc[m]) acc[m] = { q: 0, r: 0, n: 0 };
    acc[m].q += Number(r.avg_quotes_per_company) || 0;
    acc[m].r += Number(r.avg_revenue_per_company) || 0;
    acc[m].n += 1;
  }
  // Média sobre os anos cobertos
  const monthly: Record<number, { q: number; r: number }> = {};
  for (let m = 1; m <= 12; m++) {
    const v = acc[m];
    monthly[m] = v?.n ? { q: v.q / v.n, r: v.r / v.n } : { q: 0, r: 0 };
  }
  const totalQ = Object.values(monthly).reduce((s, v) => s + v.q, 0);
  const maxQ = Math.max(0, ...Object.values(monthly).map((v) => v.q));

  const cells: IndustryMonthCell[] = [];
  for (let m = 1; m <= 12; m++) {
    const v = monthly[m];
    cells.push({
      month: m,
      monthLabel: MONTH_LABELS[m - 1],
      avgQuotesPerCompany: v.q,
      avgRevenuePerCompany: v.r,
      sharePercent: totalQ > 0 ? (v.q / totalQ) * 100 : 0,
      intensity: maxQ > 0 ? v.q / maxQ : 0,
    });
  }
  return cells;
}

function pickTop<T extends { quotesCount?: number; avgQuotesPerCompany?: number }>(
  cells: T[],
  key: 'quotesCount' | 'avgQuotesPerCompany',
  n = 3,
): T[] {
  return [...cells]
    .filter((c) => (c[key] as number) > 0)
    .sort((a, b) => (b[key] as number) - (a[key] as number))
    .slice(0, n);
}

function findNextPeak(topClient: ClientMonthCell[]): { month: number; days: number } | null {
  if (topClient.length === 0) return null;
  const today = new Date();
  const peakMonths = new Set(topClient.map((c) => c.month));
  // procura nos próximos 12 meses
  for (let i = 0; i < 12; i++) {
    const candidate = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const monthNum = candidate.getMonth() + 1;
    if (peakMonths.has(monthNum)) {
      // se for o mês atual, distância = 0; senão diff até dia 1 do mês candidato
      const diffMs =
        candidate.getTime() -
        new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const days = Math.max(0, Math.round(diffMs / 86400000));
      return { month: monthNum, days };
    }
  }
  return null;
}

function buildInsight(
  topClient: ClientMonthCell[],
  topIndustry: IndustryMonthCell[],
  nextPeak: { month: number; days: number } | null,
): string | null {
  if (topClient.length === 0) return null;
  const top3Share = topClient.reduce((s, c) => s + c.sharePercent, 0);
  const top3Names = topClient.map((c) => MONTH_LABELS[c.month - 1]).join('-');

  const peakAlignsWithIndustry =
    topClient.length > 0 &&
    topIndustry.length > 0 &&
    topClient.some((c) => topIndustry.some((i) => i.month === c.month));

  let base = `Cliente concentra ${Math.round(top3Share)}% das compras em ${top3Names}.`;

  if (nextPeak) {
    if (nextPeak.days === 0) {
      base += ` Estamos no mês de pico — momento ideal para abordagem agora.`;
    } else if (nextPeak.days <= 30) {
      base += ` Próximo pico em ${nextPeak.days} dias (${MONTH_LABELS_FULL[nextPeak.month - 1]}) — momento ideal para prospecção.`;
    } else {
      base += ` Próximo pico em ${MONTH_LABELS_FULL[nextPeak.month - 1]} (${nextPeak.days} dias).`;
    }
  }

  if (peakAlignsWithIndustry) {
    base += ' Padrão alinhado com a sazonalidade do setor.';
  } else if (topIndustry.length > 0) {
    base += ` Setor concentra em ${topIndustry.map((i) => MONTH_LABELS[i.month - 1]).join('-')} — padrão diferente do mercado.`;
  }

  return base;
}

export function useClientSeasonality(
  clientId: string | null | undefined,
  ramoAtividade: string | null | undefined,
): SeasonalityResult {
  const query = useQuery({
    queryKey: ['bi', 'seasonality', clientId, ramoAtividade],
    enabled: !!clientId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (!clientId) {
        return { clientRows: [], industryRows: [], companiesCount: 0 };
      }

      // 1+2) Client RPC and companies lookup are independent — run in parallel
      const [{ data: clientData, error: clientErr }, companiesRaw] = await Promise.all([
        supabase.rpc('get_client_seasonality', {
          _client_id: clientId,
          _months: WINDOW_MONTHS,
        }),
        ramoAtividade
          ? selectCrm<{ id: string }>('companies', {
              select: 'id',
              filters: { ramo_atividade: ramoAtividade, deleted_at: null },
              limit: 500,
            }).catch((): Array<{ id: string }> => [])
          : Promise.resolve([] as Array<{ id: string }>),
      ]);
      if (clientErr) throw clientErr;
      const clientRows = (clientData ?? []) as ClientRow[];

      // 3) Industry seasonality — depends on company IDs from step 2
      let industryRows: IndustryRow[] = [];
      let companiesCount = 0;
      if (ramoAtividade && companiesRaw.length > 0) {
        try {
          const ids = companiesRaw.map((c) => c.id).filter((id) => id && id !== clientId);
          companiesCount = ids.length;
          if (ids.length > 0) {
            const { data: indData, error: indErr } = await supabase.rpc(
              'get_industry_seasonality',
              { _company_ids: ids, _months: WINDOW_MONTHS },
            );
            if (!indErr) industryRows = indData ?? [];
          }
        } catch {
          industryRows = [];
        }
      }

      return { clientRows, industryRows, companiesCount };
    },
  });

  const isLoading = query.isLoading;
  const clientRows = query.data?.clientRows ?? [];
  const industryRows = query.data?.industryRows ?? [];

  const { cells: clientCells, monthsCovered } = buildClientCells(clientRows);
  const realIndustryCells = buildIndustryCells(industryRows);
  const hasEnoughData = monthsCovered >= 3;

  // Fallback mock se cliente sem dados suficientes
  if (!hasEnoughData) {
    const mock = getMockSeasonality();
    const topClient = pickTop(mock.client, 'quotesCount', 3);
    const topIndustry = pickTop(mock.industry, 'avgQuotesPerCompany', 3);
    const nextPeak = findNextPeak(topClient);
    return {
      isLoading,
      isMock: true,
      hasEnoughData: false,
      monthsCovered,
      windowMonths: WINDOW_MONTHS,
      client: mock.client,
      industry: mock.industry,
      topClientMonths: topClient,
      topIndustryMonths: topIndustry,
      nextPeakMonth: nextPeak?.month ?? null,
      daysToNextPeak: nextPeak?.days ?? null,
      insight: buildInsight(topClient, topIndustry, nextPeak),
    };
  }

  // Se setor estiver vazio mas cliente tem dados, usa mock só do setor para comparativo visual
  const industryCells = realIndustryCells.some((c) => c.avgQuotesPerCompany > 0)
    ? realIndustryCells
    : getMockSeasonality().industry;

  const topClient = pickTop(clientCells, 'quotesCount', 3);
  const topIndustry = pickTop(industryCells, 'avgQuotesPerCompany', 3);
  const nextPeak = findNextPeak(topClient);

  return {
    isLoading,
    isMock: false,
    hasEnoughData: true,
    monthsCovered,
    windowMonths: WINDOW_MONTHS,
    client: clientCells,
    industry: industryCells,
    topClientMonths: topClient,
    topIndustryMonths: topIndustry,
    nextPeakMonth: nextPeak?.month ?? null,
    daysToNextPeak: nextPeak?.days ?? null,
    insight: buildInsight(topClient, topIndustry, nextPeak),
  };
}

export const SEASONALITY_MONTH_LABELS = MONTH_LABELS;
export const SEASONALITY_MONTH_LABELS_FULL = MONTH_LABELS_FULL;
