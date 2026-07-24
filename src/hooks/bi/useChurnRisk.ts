/**
 * useChurnRisk — sinal binário de risco de churn baseado em recência + tendência.
 * Critérios: recência > 2× intervalo médio entre pedidos OU recência > 90d combinada com queda recente.
 */
import { useMemo } from 'react';
import { useClientBI } from '@/hooks/bi/useClientBI';

export interface ChurnRiskResult {
  atRisk: boolean;
  severity: 'high' | 'low' | 'medium' | 'none';
  daysSinceLastOrder: number | null;
  averageInterval: number | null; // dias
  reason: string | null;
  suggestedAction: string;
}

export function useChurnRisk(clientId: string | null | undefined): ChurnRiskResult {
  const bi = useClientBI(clientId ?? undefined);

  return useMemo(() => {
    const days = bi.daysSinceLastOrder;

    // Calcula intervalo médio entre os últimos pedidos
    const sortedOrders = [...bi.recentOrders].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    let avgInterval: number | null = null;
    if (sortedOrders.length >= 2) {
      const intervals: number[] = [];
      for (let i = 0; i < sortedOrders.length - 1; i++) {
        const diff =
          (new Date(sortedOrders[i].date).getTime() -
            new Date(sortedOrders[i + 1].date).getTime()) /
          86400000;
        if (diff > 0) intervals.push(diff);
      }
      if (intervals.length > 0) {
        avgInterval = Math.round(intervals.reduce((s, v) => s + v, 0) / intervals.length);
      }
    }

    if (days === null) {
      return {
        atRisk: false,
        severity: 'none',
        daysSinceLastOrder: null,
        averageInterval: avgInterval,
        reason: null,
        suggestedAction: 'Sem histórico para avaliar risco.',
      };
    }

    // High: > 2x intervalo OU > 120d sem compra
    if ((avgInterval && days > avgInterval * 2 && days > 60) || days > 120) {
      return {
        atRisk: true,
        severity: 'high',
        daysSinceLastOrder: days,
        averageInterval: avgInterval,
        reason: avgInterval
          ? `Última compra há ${days}d (média histórica: ${avgInterval}d). Cliente dobrou o intervalo — risco alto.`
          : `Sem compra há ${days}d — janela crítica de churn.`,
        suggestedAction: 'Ligar hoje · oferta personalizada · agendar visita esta semana.',
      };
    }

    // Medium: > 1.5x intervalo
    if (avgInterval && days > avgInterval * 1.5 && days > 45) {
      return {
        atRisk: true,
        severity: 'medium',
        daysSinceLastOrder: days,
        averageInterval: avgInterval,
        reason: `Última compra há ${days}d vs média ${avgInterval}d — atenção.`,
        suggestedAction: 'WhatsApp esta semana · enviar novidades do setor.',
      };
    }

    return {
      atRisk: false,
      severity: 'low',
      daysSinceLastOrder: days,
      averageInterval: avgInterval,
      reason: null,
      suggestedAction: 'Cliente dentro do padrão — manter cadência normal.',
    };
  }, [bi]);
}
