/**
 * Admin AI Usage Dashboard — Refactored orchestrator
 * Sub-components extracted to ./ai-usage/
 */
import { useState } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Zap, Activity, DollarSign, Users } from 'lucide-react';
import { useAiUsageStats, useAiUsageLogs } from '@/hooks/intelligence';
import { AiSummaryCard } from '@/pages/admin/ai-usage/AiSummaryCard';
import { AiCharts } from '@/pages/admin/ai-usage/AiCharts';
import { AiTables } from '@/pages/admin/ai-usage/AiTables';
import { AiQuotaManager } from '@/pages/admin/ai-usage/AiQuotaManager';
import { MarketIntelInsightsUsagePanel } from '@/pages/admin/ai-usage/MarketIntelInsightsUsagePanel';

const formatCurrency = (val: number) => `$${val.toFixed(4)}`;
const formatNumber = (val: number) => val.toLocaleString('pt-BR');

export default function AdminAiUsagePage() {
  const [period, setPeriod] = useState<'day' | 'month' | 'week'>('month');
  const { data: stats, isLoading: statsLoading } = useAiUsageStats(period);
  const { data: logs, isLoading: logsLoading } = useAiUsageLogs({ period, limit: 200 });

  return (
    <>
      <PageSEO
        title="Consumo de IA"
        description="Dashboard de consumo de IA por usuário"
        path="/admin/consumo-ia"
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1
                data-testid="page-title-ai-usage"
                className="font-display text-2xl font-bold text-foreground"
              >
                Consumo de IA
              </h1>
              <p className="text-sm text-muted-foreground">
                Monitoramento de uso e quotas por usuário
              </p>
            </div>
          </div>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <TabsList>
              <TabsTrigger value="day">Hoje</TabsTrigger>
              <TabsTrigger value="week">7 dias</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <AiSummaryCard
            icon={<Zap className="h-4 w-4" />}
            label="Requisições"
            value={stats ? formatNumber(stats.totalRequests) : '--'}
            sub={stats ? `${stats.successCount} ok / ${stats.errorCount} erros` : ''}
            loading={statsLoading}
            color="text-primary"
          />
          <AiSummaryCard
            icon={<Activity className="h-4 w-4" />}
            label="Tokens Totais"
            value={stats ? formatNumber(stats.totalTokens) : '--'}
            sub="input + output"
            loading={statsLoading}
            color="text-primary"
          />
          <AiSummaryCard
            icon={<DollarSign className="h-4 w-4" />}
            label="Custo Estimado"
            value={stats ? formatCurrency(stats.totalCost) : '--'}
            sub="USD no período"
            loading={statsLoading}
            color="text-primary"
          />
          <AiSummaryCard
            icon={<Users className="h-4 w-4" />}
            label="Usuários Ativos"
            value={stats ? formatNumber(stats.byUser.length) : '--'}
            sub="com chamadas de IA"
            loading={statsLoading}
            color="text-primary"
          />
        </div>

        <AiCharts
          byDay={stats?.byDay ?? []}
          byFunction={stats?.byFunction ?? []}
          isLoading={statsLoading}
        />
        <AiTables
          byUser={stats?.byUser ?? []}
          byModel={stats?.byModel ?? []}
          logs={logs || []}
          statsLoading={statsLoading}
          logsLoading={logsLoading}
        />
        <MarketIntelInsightsUsagePanel />
        <AiQuotaManager />
      </div>
    </>
  );
}
