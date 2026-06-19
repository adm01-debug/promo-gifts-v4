/**
 * TrendsInsightsCard — narrativa em IA dos dados de tendências.
 * Consome a edge function `trends-insights` (Lovable AI).
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, RefreshCw, AlertTriangle, TrendingUp, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/ui';
import { cn } from '@/lib/utils';

interface TrendsInsightsCardProps {
  days: number;
}

interface InsightResponse {
  summary: string;
  what_changed: string;
  why: string;
  next_action: string;
}

export function TrendsInsightsCard({ days }: TrendsInsightsCardProps) {
  const { toast } = useToast();
  const [version, setVersion] = useState(0);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['trends-insights', days, version],
    queryFn: async (): Promise<InsightResponse | null> => {
      const { isDemoMode, MOCK_INSIGHTS } = await import('@/pages/trends/trends-mock');
      if (isDemoMode()) {
        // Simula latência leve para sensação real
        await new Promise((r) => {
          setTimeout(r, 400);
        });
        return MOCK_INSIGHTS;
      }
      const { data: rawData, error } = await supabase.functions.invoke('trends-insights', {
        body: { days },
      });
      if (error) {
        if (error.message?.includes('429')) {
          toast({
            title: 'Limite de IA atingido',
            description: 'Aguarde alguns instantes.',
            variant: 'destructive',
          });
        } else if (error.message?.includes('402')) {
          toast({
            title: 'Sem créditos de IA',
            description: 'Adicione créditos no workspace.',
            variant: 'destructive',
          });
        }
        throw error;
      }
      return rawData as InsightResponse;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const handleRefresh = () => {
    setVersion((v) => v + 1);
    refetch();
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-chart-2/5">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Insights da IA
          </CardTitle>
          <CardDescription>Análise narrativa dos últimos {days} dias</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isFetching}
          aria-label="Regenerar insights"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : isError ? (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>Não foi possível gerar insights agora. Tente novamente em instantes.</span>
          </div>
        ) : data ? (
          <div className="space-y-3 text-sm">
            {data.summary && (
              <p className="font-medium leading-relaxed text-foreground">{data.summary}</p>
            )}
            <div className="grid gap-2.5">
              <InsightRow
                icon={<TrendingUp className="h-4 w-4 text-chart-2" />}
                label="O que mudou"
                text={data.what_changed}
              />
              <InsightRow
                icon={<Lightbulb className="h-4 w-4 text-chart-4" />}
                label="Por quê"
                text={data.why}
              />
              <InsightRow
                icon={<Sparkles className="h-4 w-4 text-primary" />}
                label="Próxima ação"
                text={data.next_action}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function InsightRow({
  icon,
  label,
  text,
}: {
  icon: React.ReactNode;
  label: string;
  text?: string;
}) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-border/40 bg-card/60 p-2.5">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
      </div>
    </div>
  );
}
