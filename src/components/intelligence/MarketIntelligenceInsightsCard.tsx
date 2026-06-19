/**
 * MarketIntelligenceInsightsCard — narrativa em IA dos dados do dashboard de Inteligência de Mercado.
 * Consome a edge function `market-intelligence-insights` (Lovable AI).
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Star,
  Database,
  Inbox,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/ui';

interface Props {
  days: number;
  categoryId?: string | null;
  supplierId?: string | null;
  productId?: string | null;
  categoryName?: string | null;
  supplierName?: string | null;
  productName?: string | null;
}

interface InsightResponse {
  summary: string;
  what_changed: string;
  why: string;
  next_action: string;
  highlights?: string[];
  empty?: boolean;
  cached?: boolean;
  generated_at?: string;
}

export function MarketIntelligenceInsightsCard({
  days,
  categoryId,
  supplierId,
  productId,
  categoryName,
  supplierName,
  productName,
}: Props) {
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['market-intelligence-insights', days, categoryId, supplierId, productId],
    queryFn: async (): Promise<InsightResponse> => {
      const { data: rawData, error } = await supabase.functions.invoke(
        'market-intelligence-insights',
        {
          body: {
            days,
            categoryId,
            supplierId,
            productId,
            categoryName,
            supplierName,
            productName,
          },
        },
      );
      if (error) {
        if (error.message?.includes('429')) {
          toast({
            title: 'Limite de IA atingido',
            description: 'Aguarde alguns instantes ou verifique sua quota.',
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

  const filterChips = [
    categoryName && `Categoria: ${categoryName}`,
    supplierName && `Fornecedor: ${supplierName}`,
    productName && `Produto: ${productName}`,
  ].filter(Boolean) as string[];

  return (
    <TooltipProvider>
      <Card className="animate-fade-in border-primary/30 bg-gradient-to-br from-primary/5 via-background to-chart-2/5">
        <CardHeader className="pb-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-primary" />
              Insights da IA
              {data?.cached && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="gap-1 border-chart-2/40 px-1.5 py-0 text-[10px] text-chart-2"
                    >
                      <Database className="h-2.5 w-2.5" /> Cache
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      Gerado em{' '}
                      {data.generated_at
                        ? new Date(data.generated_at).toLocaleString('pt-BR')
                        : '—'}
                      .
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5">
              <span>Análise dos últimos {days} dias</span>
              {filterChips.map((c) => (
                <Badge
                  key={c}
                  variant="outline"
                  className="border-primary/30 px-1.5 py-0 text-[10px] text-primary"
                >
                  {c}
                </Badge>
              ))}
            </CardDescription>
          </div>
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
          ) : data?.empty ? (
            <div className="flex items-start gap-3 rounded-md border border-dashed border-border bg-muted/40 p-4">
              <Inbox className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">{data.summary}</p>
                <p className="text-xs text-muted-foreground">{data.next_action}</p>
              </div>
            </div>
          ) : data ? (
            <div className="space-y-3 text-sm">
              {data.summary && (
                <p className="animate-fade-in font-medium leading-relaxed text-foreground">
                  {data.summary}
                </p>
              )}
              <div className="grid gap-2.5">
                <InsightRow
                  icon={<TrendingUp className="h-4 w-4 text-chart-2" />}
                  label="O que mudou"
                  text={data.what_changed}
                  delay={50}
                />
                <InsightRow
                  icon={<Lightbulb className="h-4 w-4 text-chart-4" />}
                  label="Por quê"
                  text={data.why}
                  delay={100}
                />
                <InsightRow
                  icon={<Sparkles className="h-4 w-4 text-primary" />}
                  label="Próxima ação"
                  text={data.next_action}
                  delay={150}
                />
                {data.highlights && data.highlights.length > 0 && (
                  <div
                    className="flex animate-fade-in items-start gap-2 rounded-md border border-border/40 bg-card/60 p-2.5"
                    style={{ animationDelay: '200ms' }}
                  >
                    <div className="mt-0.5 shrink-0">
                      <Star className="h-4 w-4 text-chart-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Destaques
                      </p>
                      <ul className="list-disc space-y-0.5 pl-4 text-sm leading-relaxed text-foreground/90">
                        {data.highlights.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function InsightRow({
  icon,
  label,
  text,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  text?: string;
  delay?: number;
}) {
  if (!text) return null;
  return (
    <div
      className="flex animate-fade-in items-start gap-2 rounded-md border border-border/40 bg-card/60 p-2.5"
      style={{ animationDelay: `${delay}ms` }}
    >
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
