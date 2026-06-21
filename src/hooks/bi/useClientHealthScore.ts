/**
 * useClientHealthScore — score 0-100 de saúde do cliente.
 *
 * Pesos:
 *  - Recência       30% (≤30d=100, ≤60d=80, ≤90d=60, ≤180d=30, >180d=0)
 *  - Frequência     25% (vs média do setor)
 *  - Ticket vs setor 20%
 *  - Crescimento trim. 15% (compara últimos 3m vs 3m anteriores via sazonalidade)
 *  - Share-of-wallet 10% (estimativa)
 *
 * Tier: 🟢 Saudável >75 · 🟡 Atenção 50-75 · 🔴 Risco <50
 */
import { useMemo } from 'react';
import { useClientBI } from '@/hooks/bi/useClientBI';
import { useClientVsIndustry } from '@/hooks/bi/useClientVsIndustry';
import { useClientSeasonality } from '@/hooks/bi/useClientSeasonality';

export type HealthTier = 'attention' | 'healthy' | 'risk' | 'unknown';

export interface HealthScoreBreakdown {
  recency: { score: number; weight: number; label: string };
  frequency: { score: number; weight: number; label: string };
  ticket: { score: number; weight: number; label: string };
  growth: { score: number; weight: number; label: string };
  shareOfWallet: { score: number; weight: number; label: string };
}

export interface ClientHealthScoreResult {
  isLoading: boolean;
  score: number; // 0-100
  tier: HealthTier;
  breakdown: HealthScoreBreakdown;
  shareOfWalletPct: number; // estimativa
  potentialUntappedBRL: number;
  growthPct: number; // % vs trimestre anterior
  nextActionLabel: string;
  nextActionDetail: string;
  scriptHint: string;
  windowLabel: string;
  crossZoneInsight: string;
  ctaLabel: string;
  ctaUrgent: boolean;
}

function recencyScore(days: number | null): number {
  if (days === null) return 0;
  if (days <= 30) return 100;
  if (days <= 60) return 80;
  if (days <= 90) return 60;
  if (days <= 180) return 30;
  return 0;
}

function ratioScore(client: number, industry: number): number {
  if (!industry || industry <= 0) return client > 0 ? 60 : 0;
  const ratio = client / industry;
  if (ratio >= 1.3) return 100;
  if (ratio >= 1.1) return 90;
  if (ratio >= 0.9) return 75;
  if (ratio >= 0.7) return 55;
  if (ratio >= 0.5) return 35;
  return 15;
}

function tierFromScore(score: number): HealthTier {
  if (score >= 75) return 'healthy';
  if (score >= 50) return 'attention';
  return 'risk';
}

export function useClientHealthScore(
  clientId: string | null | undefined,
  ramoAtividade: string | null | undefined,
): ClientHealthScoreResult {
  const bi = useClientBI(clientId ?? undefined);
  const vs = useClientVsIndustry(clientId, ramoAtividade);
  const seas = useClientSeasonality(clientId, ramoAtividade);

  return useMemo(() => {
    const isLoading = bi.isLoading || vs.isLoading || seas.isLoading;

    // ---- Recência ----
    const recScore = recencyScore(bi.daysSinceLastOrder);

    // ---- Frequência vs setor ----
    const freqMetric = vs.metrics.find((m) => m.label === 'Frequência (pedidos)');
    const freqScore = freqMetric
      ? ratioScore(freqMetric.clientValue, freqMetric.industryAvg)
      : ratioScore(bi.ordersCount, 10);

    // ---- Ticket vs setor ----
    const ticketMetric = vs.metrics.find((m) => m.label === 'Ticket médio');
    const ticketScore = ticketMetric
      ? ratioScore(ticketMetric.clientValue, ticketMetric.industryAvg)
      : ratioScore(bi.avgTicket, 2500);

    // ---- Crescimento (últimos 3m vs 3m anteriores via sazonalidade) ----
    const now = new Date();
    const monthIdx = now.getMonth(); // 0-11
    const last3 = [0, 1, 2].map((i) => {
      const m = ((monthIdx - i + 12) % 12) + 1;
      return seas.client.find((c) => c.month === m)?.quotesCount ?? 0;
    });
    const prev3 = [3, 4, 5].map((i) => {
      const m = ((monthIdx - i + 12) % 12) + 1;
      return seas.client.find((c) => c.month === m)?.quotesCount ?? 0;
    });
    const sumLast = last3.reduce((s, v) => s + v, 0);
    const sumPrev = prev3.reduce((s, v) => s + v, 0);
    const growthPct = sumPrev > 0 ? ((sumLast - sumPrev) / sumPrev) * 100 : sumLast > 0 ? 50 : 0;
    const growthScore = Math.max(0, Math.min(100, 50 + growthPct)); // -50%→0, 0%→50, +50%→100

    // ---- Share-of-wallet (estimativa: ticket cliente vs ticket setor × frequência ideal) ----
    const industryAnnualPotential = ticketMetric
      ? ticketMetric.industryAvg * 12
      : bi.avgTicket * 12 || 30000;
    const clientAnnualActual = bi.ltv > 0 ? bi.ltv : bi.avgTicket * bi.ordersCount;
    const sharePct =
      industryAnnualPotential > 0
        ? Math.min(100, (clientAnnualActual / industryAnnualPotential) * 100)
        : 0;
    const shareScore = Math.min(100, sharePct * 1.5); // share alto = bom; teto 100
    const potentialUntapped = Math.max(0, industryAnnualPotential - clientAnnualActual);

    // ---- Score consolidado ----
    const score = Math.round(
      recScore * 0.3 + freqScore * 0.25 + ticketScore * 0.2 + growthScore * 0.15 + shareScore * 0.1,
    );
    const tier = tierFromScore(score);

    // ---- Próxima ação ----
    let nextActionLabel = 'Manter cadência';
    let nextActionDetail = 'Cliente saudável — acompanhar no próximo ciclo de campanha.';
    let scriptHint =
      'Olá! Passando para alinhar próximas demandas — vi que estamos no seu mês de pico histórico.';
    let ctaUrgent = false;

    if (recScore <= 30) {
      nextActionLabel = 'Reativar agora';
      nextActionDetail = bi.daysSinceLastOrder
        ? `Última compra há ${bi.daysSinceLastOrder}d — janela crítica de retenção.`
        : 'Cliente sem histórico recente — abordagem prioritária.';
      scriptHint =
        'Sentimos sua falta! Preparei uma seleção exclusiva baseada nos produtos que você mais gosta.';
      ctaUrgent = true;
    } else if (seas.daysToNextPeak !== null && seas.daysToNextPeak <= 30) {
      nextActionLabel =
        seas.daysToNextPeak === 0 ? 'Abordar agora · pico' : `Abordar em ${seas.daysToNextPeak}d`;
      nextActionDetail = `Cliente entra em mês de pico em breve — momento ideal para envio de orçamento.`;
      scriptHint =
        'Estamos na sua janela histórica de compra — separei os destaques do setor para você avaliar.';
      ctaUrgent = true;
    } else if (sharePct < 20 && potentialUntapped > 30000) {
      nextActionLabel = 'Cross-sell agressivo';
      nextActionDetail = `Share-of-wallet estimado em ${Math.round(sharePct)}% — há R$ ${Math.round(potentialUntapped).toLocaleString('pt-BR')} em potencial não capturado.`;
      scriptHint =
        'Notei que ainda não trabalhamos algumas linhas que são padrão no seu setor — posso te mostrar?';
    } else if (ticketScore >= 75 && growthPct > 0) {
      nextActionLabel = 'Upsell premium';
      nextActionDetail = 'Ticket alto + crescendo — perfil ideal para ofertar linha premium.';
      scriptHint =
        'Acabou de chegar uma linha premium que combina com o perfil de compra que você costuma escolher.';
    }

    // ---- Janela ideal ----
    const windowLabel =
      seas.daysToNextPeak === 0
        ? 'Hoje · pico ativo'
        : seas.daysToNextPeak !== null && seas.nextPeakMonth !== null
          ? `${seas.daysToNextPeak}d → mês de pico histórico`
          : 'Sem janela sazonal definida';

    // ---- Insight cross-zona ----
    const peakNote =
      seas.daysToNextPeak === 0
        ? `está em mês de pico histórico (+${Math.round(seas.topClientMonths[0]?.sharePercent ?? 0)}% do volume anual)`
        : seas.daysToNextPeak !== null && seas.daysToNextPeak <= 30
          ? `entra em pico em ${seas.daysToNextPeak} dias`
          : `tem padrão sazonal definido`;

    const ltvNote = ticketMetric
      ? ticketMetric.deltaPercent > 15
        ? `, com ticket ${Math.round(ticketMetric.deltaPercent)}% acima do setor`
        : ticketMetric.deltaPercent < -15
          ? `, com ticket ${Math.abs(Math.round(ticketMetric.deltaPercent))}% abaixo do setor`
          : ''
      : '';

    const growthNote =
      growthPct < -15
        ? ` mas frequência caiu ${Math.abs(Math.round(growthPct))}% no último trimestre — momento de reativação.`
        : growthPct > 15
          ? ` e cresce ${Math.round(growthPct)}% no trimestre — acelerar oportunidades.`
          : '.';

    const crossZoneInsight = `Cliente ${peakNote}${ltvNote}${growthNote}`;

    const ctaLabel =
      ctaUrgent && seas.daysToNextPeak !== null && seas.daysToNextPeak <= 30
        ? 'Criar orçamento de oportunidade'
        : 'Criar orçamento com sugestões';

    return {
      isLoading,
      score: isLoading ? 0 : score,
      tier: isLoading ? 'unknown' : tier,
      breakdown: {
        recency: { score: recScore, weight: 30, label: 'Recência' },
        frequency: { score: freqScore, weight: 25, label: 'Frequência' },
        ticket: { score: ticketScore, weight: 20, label: 'Ticket vs setor' },
        growth: { score: growthScore, weight: 15, label: 'Crescimento' },
        shareOfWallet: { score: shareScore, weight: 10, label: 'Share-of-wallet' },
      },
      shareOfWalletPct: Math.round(sharePct * 10) / 10,
      potentialUntappedBRL: Math.round(potentialUntapped),
      growthPct: Math.round(growthPct),
      nextActionLabel,
      nextActionDetail,
      scriptHint,
      windowLabel,
      crossZoneInsight,
      ctaLabel,
      ctaUrgent,
    };
  }, [bi, vs, seas]);
}
