/**
 * ClientHealthHero — primeiro card no topo do BI.
 * Score 0-100 + tier semântico + insight cross-zona + chips de ação + CTA principal.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Activity,
  Sparkles,
  ArrowRight,
  Phone,
  CalendarClock,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Info,
  Star,
  Target as TargetIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientHealthScore } from '@/hooks/bi/useClientHealthScore';
import { useClientAffinity } from '@/hooks/bi/useClientAffinity';
import { useIndustryTrends } from '@/hooks/bi/useIndustryTrends';
import { useClientCategoryAffinity } from '@/hooks/bi/useClientCategoryAffinity';
import { useIndustryCategoryTrends } from '@/hooks/bi/useIndustryCategoryTrends';
import { ConfirmQuoteSuggestionsModal, type SuggestionItem } from './ConfirmQuoteSuggestionsModal';

interface Props {
  clientId: string;
  ramoAtividade: string | null;
  clientName: string;
}

const TIER_STYLES = {
  healthy: {
    ring: 'ring-emerald-500/40',
    bgGradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    scoreText: 'text-emerald-600 dark:text-emerald-400',
    progressBar: '[&>div]:bg-emerald-500',
    icon: CheckCircle2,
    label: 'Saudável',
  },
  attention: {
    ring: 'ring-amber-500/40',
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    badgeBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    scoreText: 'text-amber-600 dark:text-amber-400',
    progressBar: '[&>div]:bg-amber-500',
    icon: AlertTriangle,
    label: 'Atenção',
  },
  risk: {
    ring: 'ring-red-500/40',
    bgGradient: 'from-red-500/10 via-red-500/5 to-transparent',
    badgeBg: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
    scoreText: 'text-red-600 dark:text-red-400',
    progressBar: '[&>div]:bg-red-500',
    icon: AlertTriangle,
    label: 'Risco',
  },
  unknown: {
    ring: 'ring-muted',
    bgGradient: 'from-muted/30 to-transparent',
    badgeBg: 'bg-muted text-muted-foreground border-border',
    scoreText: 'text-muted-foreground',
    progressBar: '',
    icon: Info,
    label: 'Calculando',
  },
} as const;

export function ClientHealthHero({ clientId, ramoAtividade, clientName }: Props) {
  const health = useClientHealthScore(clientId, ramoAtividade);
  const affinity = useClientAffinity(clientId);
  const trends = useIndustryTrends(ramoAtividade);
  const clientCats = useClientCategoryAffinity(clientId);
  const industryCats = useIndustryCategoryTrends(ramoAtividade);
  const [open, setOpen] = useState(false);

  // Categoria favorita do cliente (top 1 por receita)
  const favoriteCategory = clientCats.favorite;
  // Categoria-oportunidade: setor compra muito, cliente quase nada
  const opportunityCategory = useMemo(() => {
    const clientSlugs = new Set(clientCats.categories.map((c) => c.slug));
    return (
      industryCats.categories
        .filter((ic) => ic.revenueSharePct >= 8 && !clientSlugs.has(ic.slug))
        .sort((a, b) => b.revenueSharePct - a.revenueSharePct)[0] ?? null
    );
  }, [clientCats.categories, industryCats.categories]);

  const styles = TIER_STYLES[health.tier];
  const Icon = styles.icon;

  // Monta sugestões: top 3 afinidade + top 2 tendência setor
  const suggestions = useMemo<SuggestionItem[]>(() => {
    const list: SuggestionItem[] = [];
    const affList =
      affinity.data?.categories?.flatMap((c) =>
        c.suggestions.slice(0, 1).map((s) => ({
          name: s.name,
          priceFrom: s.priceFrom,
          priceTo: s.priceTo,
          reason: s.reason,
          productId: s.productId ?? null,
          imageUrl: s.imageUrl ?? null,
          source: 'affinity' as const,
        })),
      ) ?? [];
    list.push(...affList.slice(0, 3));

    const trendList = (trends.data?.trends ?? []).slice(0, 5).map((t) => ({
      name: t.productName,
      priceFrom: Math.round(t.avgPrice * 0.9),
      priceTo: Math.round(t.avgPrice * 1.15),
      reason: `Top ${t.category} no setor (${t.unitsSold.toLocaleString('pt-BR')} un)`,
      productId: t.productId ?? null,
      imageUrl: t.imageUrl ?? null,
      source: 'industry' as const,
    }));

    const seen = new Set(list.map((i) => i.name.toLowerCase()));
    for (const t of trendList) {
      if (!seen.has(t.name.toLowerCase())) {
        list.push(t);
        seen.add(t.name.toLowerCase());
      }
      if (list.length >= 5) break;
    }
    return list.slice(0, 5);
  }, [affinity.data, trends.data]);

  if (health.isLoading) {
    return (
      <Card className="border-[1.5px]">
        <CardContent className="space-y-4 p-6">
          <div className="flex gap-4">
            <Skeleton className="h-28 w-28 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const breakdownEntries = Object.values(health.breakdown);

  return (
    <>
      <Card
        className={cn(
          'overflow-hidden border-[1.5px] bg-gradient-to-br ring-1',
          styles.ring,
          styles.bgGradient,
        )}
      >
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col items-start gap-5 lg:flex-row lg:gap-6">
            {/* Score circular */}
            <div className="flex shrink-0 items-center gap-4 lg:flex-col lg:items-center lg:gap-2">
              <div
                className={cn(
                  'relative flex h-28 w-28 flex-col items-center justify-center rounded-2xl',
                  'border-[1.5px] bg-background/80 shadow-sm backdrop-blur',
                  styles.ring,
                )}
              >
                <span
                  className={cn(
                    'font-display text-4xl font-bold tabular-nums leading-none',
                    styles.scoreText,
                  )}
                >
                  {health.score}
                </span>
                <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Health Score
                </span>
              </div>
              <Badge
                variant="outline"
                className={cn('gap-1 border', styles.badgeBg, 'justify-center lg:w-full')}
              >
                <Icon className="h-3 w-3" />
                {styles.label}
              </Badge>
            </div>

            {/* Conteúdo central */}
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Diagnóstico do cliente
                    </span>
                  </div>
                  <h2 className="mt-1 max-w-[40ch] truncate font-display text-lg font-bold sm:text-xl">
                    {clientName}
                  </h2>
                </div>
              </div>

              {/* Insight cross-zona */}
              <p className="text-sm leading-relaxed text-foreground/90">
                {health.crossZoneInsight}
              </p>

              {/* Categoria favorita + oportunidade */}
              {(favoriteCategory || opportunityCategory) && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {favoriteCategory && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                      <Star className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div className="min-w-0">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          Categoria favorita
                        </div>
                        <div className="truncate text-xs font-semibold">
                          {favoriteCategory.label}{' '}
                          <span className="font-normal text-muted-foreground">
                            ({favoriteCategory.revenueSharePct.toFixed(0)}% do total)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {opportunityCategory && (
                    <div className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 p-2.5">
                      <TargetIcon className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                      <div className="min-w-0">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-violet-700 dark:text-violet-300">
                          Oportunidade no setor
                        </div>
                        <div className="truncate text-xs font-semibold">
                          {opportunityCategory.label}{' '}
                          <span className="font-normal text-muted-foreground">
                            (setor: {opportunityCategory.revenueSharePct.toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chips: ação · janela · script */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex cursor-help items-start gap-2 rounded-lg border bg-background/60 p-2.5">
                        <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Próxima ação
                          </div>
                          <div className="truncate text-xs font-semibold">
                            {health.nextActionLabel}
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{health.nextActionDetail}</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex cursor-help items-start gap-2 rounded-lg border bg-background/60 p-2.5">
                        <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Janela ideal
                          </div>
                          <div className="truncate text-xs font-semibold">{health.windowLabel}</div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        Baseado no padrão sazonal histórico do cliente nos últimos 24 meses.
                      </p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex cursor-help items-start gap-2 rounded-lg border bg-background/60 p-2.5">
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Script sugerido
                          </div>
                          <div className="truncate text-xs font-semibold">Ver abertura</div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs leading-relaxed">"{health.scriptHint}"</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Breakdown */}
              <details className="group">
                <summary className="flex cursor-pointer select-none list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <span>Como esse score é calculado?</span>
                  <ArrowRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {breakdownEntries.map((b) => (
                    <div key={b.label} className="space-y-1 rounded-md border bg-background/60 p-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] text-muted-foreground">{b.label}</span>
                        <span className="text-[10px] font-bold tabular-nums">
                          {Math.round(b.score)}
                        </span>
                      </div>
                      <Progress value={b.score} className={cn('h-1', styles.progressBar)} />
                      <div className="text-[9px] text-muted-foreground">peso {b.weight}%</div>
                    </div>
                  ))}
                </div>
              </details>
            </div>

            {/* CTA */}
            <div className="flex w-full shrink-0 flex-col gap-2 lg:w-56">
              <Button
                size="lg"
                onClick={() => setOpen(true)}
                className={cn(
                  'w-full gap-2 font-semibold shadow-md',
                  health.ctaUrgent
                    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-700 hover:to-fuchsia-700'
                    : '',
                )}
              >
                <Sparkles className="h-4 w-4" />
                {health.ctaLabel}
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
              <p className="px-1 text-center text-[10px] leading-snug text-muted-foreground">
                Pré-popula orçamento com top 3 afinidade + top 2 tendência setor
              </p>
              {health.shareOfWalletPct > 0 && (
                <div className="mt-1 rounded-lg border bg-background/60 p-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    Share-of-wallet
                  </div>
                  <div className="font-display text-lg font-bold leading-tight">
                    {health.shareOfWalletPct}%
                  </div>
                  {health.potentialUntappedBRL > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                      Potencial: R$ {health.potentialUntappedBRL.toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmQuoteSuggestionsModal
        open={open}
        onOpenChange={setOpen}
        clientId={clientId}
        clientName={clientName}
        suggestions={suggestions}
      />
    </>
  );
}
