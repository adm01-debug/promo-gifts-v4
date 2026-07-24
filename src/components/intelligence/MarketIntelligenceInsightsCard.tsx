/**
 * MarketIntelligenceInsightsCard — narrativa em IA dos dados do dashboard de Inteligência de Mercado.
 * Consome a edge function `market-intelligence-insights` (Lovable AI).
 *
 * Controles de foco: permite direcionar a "próxima ação" para conversão, ticket
 * médio ou ruptura/estoque. O foco entra na cache key do backend, então cada
 * eixo tem seu próprio insight persistido; o botão "Regenerar" força refresh.
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Star,
  Database,
  Inbox,
  RefreshCw,
  Target,
  Wallet,
  PackageX,
  Wand2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/ui';
import { invokeEdge } from '@/lib/edge/safeInvokeCall';
import {
  useZeroResultDiagnosis,
  type FilterKey,
  type ZeroResultDiagnosis,
} from '@/hooks/intelligence/useZeroResultDiagnosis';

const FILTER_LABEL: Record<FilterKey, string> = {
  category: 'categoria',
  supplier: 'fornecedor',
  product: 'produto',
};

/**
 * Constrói uma frase PT-BR que menciona o filtro culpado (ou janela) e,
 * quando aplicável, a prévia de recuperação ao remover o filtro ou ampliar a janela.
 */
function buildDiagnosisMention(
  diag: ZeroResultDiagnosis | undefined,
  days: number,
  names: { category?: string | null; supplier?: string | null; product?: string | null },
): string | null {
  if (!diag || !diag.culprit) return null;
  const c = diag.culprit;
  if (c === 'window') {
    const w = diag.widenedPreview;
    if (w && (w.quotes > 0 || w.orders > 0)) {
      return `Diagnóstico: a janela de ${days} dias é o gargalo — ampliando para ${w.days} dias, apareceriam ${w.quotes} orçamento(s) e ${w.orders} pedido(s).`;
    }
    return `Diagnóstico: a janela de ${days} dias não capturou atividade — considere ampliar para 90 ou 180 dias.`;
  }
  if (c === 'intersection') {
    const w = diag.widenedPreview;
    const tail = w && (w.quotes > 0 || w.orders > 0)
      ? ` Ampliando a janela para ${w.days} dias, viriam ${w.quotes} orçamento(s) e ${w.orders} pedido(s).`
      : '';
    return `Diagnóstico: a combinação atual de filtros está vazia na janela de ${days} dias.${tail}`;
  }
  const label = FILTER_LABEL[c];
  const nameMap: Record<FilterKey, string | null | undefined> = {
    category: names.category,
    supplier: names.supplier,
    product: names.product,
  };
  const name = nameMap[c];
  const nameSuffix = name ? ` "${name}"` : '';
  const q = diag.leaveOneOut[c];
  const o = diag.leaveOneOutOrders[c];
  const preview =
    q != null && o != null
      ? ` — removê-lo recuperaria ${q} orçamento(s) e ${o} pedido(s)`
      : '';
  return `Diagnóstico: o filtro de ${label}${nameSuffix} está zerando os dados${preview}.`;
}

export type InsightFocus = 'auto' | 'conversion' | 'ticket' | 'rupture';

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

const FOCUS_OPTIONS: Array<{
  value: InsightFocus;
  label: string;
  hint: string;
  Icon: typeof Target;
}> = [
  { value: 'auto', label: 'Automático', hint: 'A IA escolhe o gargalo mais crítico.', Icon: Wand2 },
  { value: 'conversion', label: 'Conversão', hint: 'Foca em orçamentos que não viraram pedido.', Icon: Target },
  { value: 'ticket', label: 'Ticket médio', hint: 'Foca em cross-sell, upsell e mix.', Icon: Wallet },
  { value: 'rupture', label: 'Ruptura / Estoque', hint: 'Foca em risco de falta e reposição.', Icon: PackageX },
];

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
  const [focus, setFocus] = useState<InsightFocus>('auto');
  const [forceRefreshTick, setForceRefreshTick] = useState(0);
  const { data: diagnosis } = useZeroResultDiagnosis({
    enabled: data?.empty === true,
    days,
    categoryId,
    supplierId,
    productId,
    categoryName,
    supplierName,
    productName,
  });

  const diagnosisMention = data?.empty
    ? buildDiagnosisMention(diagnosis, days, {
        category: categoryName,
        supplier: supplierName,
        product: productName,
      })
    : null;


  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: [
      'market-intelligence-insights',
      days,
      categoryId,
      supplierId,
      productId,
      focus,
      forceRefreshTick,
    ],
    queryFn: async (): Promise<InsightResponse> => {
      const { data: queryRows, error } = await invokeEdge('market-intelligence-insights', {
        body: {
          days,
          categoryId,
          supplierId,
          productId,
          categoryName,
          supplierName,
          productName,
          focus,
          forceRefresh: forceRefreshTick > 0,
        },
      });
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
        throw new Error(error.message);
      }
      return queryRows as InsightResponse;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const handleFocusChange = (next: string) => {
    if (!next) return; // ToggleGroup permite desmarcar; ignoramos para manter sempre um foco.
    const parsed = next as InsightFocus;
    if (parsed === focus) return;
    setFocus(parsed);
    setForceRefreshTick(0); // troca de foco usa cache próprio; não força refresh.
  };

  const handleRegenerate = () => {
    setForceRefreshTick((t) => t + 1);
    // Aguarda tick propagar como queryKey nova antes de refetch.
    setTimeout(() => refetch(), 0);
  };

  const filterChips = [
    categoryName && `Categoria: ${categoryName}`,
    supplierName && `Fornecedor: ${supplierName}`,
    productName && `Produto: ${productName}`,
  ].filter(Boolean) as string[];

  return (
    <TooltipProvider>
      <Card className="animate-fade-in border-primary/30 bg-gradient-to-br from-primary/5 via-background to-chart-2/5">
        <CardHeader className="gap-3 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
            <div className="flex shrink-0 items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRegenerate}
                    disabled={isFetching}
                    aria-label="Regenerar próxima ação"
                    data-testid="market-insights-regenerate"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
                      aria-hidden
                    />
                    <span className="ml-1.5 text-xs">Regenerar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Força uma nova chamada à IA ignorando o cache.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div
            className="flex flex-col gap-1.5"
            role="group"
            aria-label="Foco da próxima ação sugerida pela IA"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Foco da próxima ação
            </span>
            <ToggleGroup
              type="single"
              value={focus}
              onValueChange={handleFocusChange}
              variant="outline"
              size="sm"
              className="flex flex-wrap justify-start gap-1.5"
              data-testid="market-insights-focus"
            >
              {FOCUS_OPTIONS.map(({ value, label, hint, Icon }) => (
                <Tooltip key={value}>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      value={value}
                      aria-label={`Foco: ${label}`}
                      aria-pressed={focus === value}
                      data-testid={`market-insights-focus-${value}`}
                      className="h-8 gap-1.5 px-2.5 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {label}
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{hint}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </ToggleGroup>
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
            <div
              className="flex items-start gap-3 rounded-md border border-dashed border-border bg-muted/40 p-4"
              data-testid="market-insights-empty"
            >
              <Inbox className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">{data.summary}</p>
                <p className="text-xs text-muted-foreground">{data.next_action}</p>
                {diagnosisMention && (
                  <p
                    className="text-xs font-medium text-foreground/90"
                    data-testid="market-insights-diagnosis-mention"
                  >
                    {diagnosisMention}
                  </p>
                )}
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
                  label={`Próxima ação · ${
                    FOCUS_OPTIONS.find((o) => o.value === focus)?.label ?? 'Automático'
                  }`}
                  text={data.next_action}
                  delay={150}
                  testId="market-insights-next-action"
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
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  text?: string;
  delay?: number;
  testId?: string;
}) {
  if (!text) return null;
  return (
    <div
      className="flex animate-fade-in items-start gap-2 rounded-md border border-border/40 bg-card/60 p-2.5"
      style={{ animationDelay: `${delay}ms` }}
      data-testid={testId}
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
