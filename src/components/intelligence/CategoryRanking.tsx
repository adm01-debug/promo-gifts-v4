import { useState, useMemo, useCallback } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, TrendingUp, Store, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { useCategoryRanking, type CategoryRankingItem } from '@/hooks/intelligence';
import { cn } from '@/lib/utils';
import { IntelligenceEmptyState } from './IntelligenceEmptyState';

type SortMode = 'combined' | 'internal' | 'market';

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'] as const;

const MODE_LABELS: Record<SortMode, string> = {
  combined: 'Combinado',
  internal: 'Receita Interna',
  market: 'Volume Mercado',
};
type ViewMode = 'chart' | 'list';

interface PieDatum {
  name: string;
  fullName: string;
  value: number;
  internalRevenue: number;
  marketDepleted: number;
  fill: string;
}

const PIE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
  'hsl(160, 84%, 39%)',
  'hsl(38, 92%, 50%)',
  'hsl(340, 82%, 52%)',
];

interface CategoryRankingProps {
  days?: number;
  categoryId?: string | null;
  supplierId?: string | null;
  productId?: string | null;
  categoryName?: string | null;
}

export function CategoryRanking({
  days = 30,
  categoryId,
  supplierId,
  productId,
  categoryName,
}: CategoryRankingProps) {
  const [sortMode, setSortMode] = useState<SortMode>('combined');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const { data: categories, isLoading } = useCategoryRanking(
    days,
    categoryId,
    supplierId,
    productId,
  );

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(v);

  const formatNumber = (v: number) =>
    new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);

  const sortedCategories = useMemo(() => {
    if (!categories?.length) return [];
    const sorted = [...categories];
    switch (sortMode) {
      case 'internal':
        return sorted.sort((a, b) => b.internalRevenue - a.internalRevenue);
      case 'market':
        return sorted.sort((a, b) => b.marketDepleted - a.marketDepleted);
      default:
        return sorted.sort((a, b) => b.totalScore - a.totalScore);
    }
  }, [categories, sortMode]);

  const getBarValue = useCallback(
    (cat: CategoryRankingItem): number => {
      switch (sortMode) {
        case 'internal':
          return cat.internalRevenue;
        case 'market':
          return cat.marketDepleted;
        default:
          return cat.totalScore;
      }
    },
    [sortMode],
  );

  const getDisplayValue = (cat: CategoryRankingItem): string => {
    switch (sortMode) {
      case 'internal':
        return formatCurrency(cat.internalRevenue);
      case 'market':
        return `${formatNumber(cat.marketDepleted)} un.`;
      default:
        return formatCurrency(cat.internalRevenue);
    }
  };

  const pieData = useMemo(() => {
    if (!sortedCategories.length) return [];
    const top = sortedCategories.slice(0, 8);
    const rest = sortedCategories.slice(8);
    const restValue = rest.reduce((s, c) => s + getBarValue(c), 0);

    const items = top.map((cat, i) => ({
      name:
        cat.categoryName.length > 18 ? `${cat.categoryName.substring(0, 18)}…` : cat.categoryName,
      fullName: cat.categoryName,
      value: getBarValue(cat),
      internalRevenue: cat.internalRevenue,
      marketDepleted: cat.marketDepleted,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));

    if (restValue > 0) {
      items.push({
        name: 'Outras',
        fullName: `Outras (${rest.length} categorias)`,
        value: restValue,
        internalRevenue: rest.reduce((s, c) => s + c.internalRevenue, 0),
        marketDepleted: rest.reduce((s, c) => s + c.marketDepleted, 0),
        fill: 'hsl(var(--muted-foreground))',
      });
    }

    return items;
  }, [sortedCategories, getBarValue]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const hasData = sortedCategories.length > 0;
  const maxVal = hasData ? Math.max(...sortedCategories.map(getBarValue)) : 0;

  // Use opacity-based approach so bars follow the skin
  const getBarOpacity = (i: number) => Math.max(1 - i * 0.06, 0.35);

  const CustomTooltipContent = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: { payload: PieDatum }[];
  }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const total = pieData.reduce((s, p) => s + p.value, 0);
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
    return (
      <div className="space-y-1 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
        <p className="font-semibold text-foreground">{d.fullName}</p>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-success" />
          <span>Interno: {formatCurrency(d.internalRevenue)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Store className="h-3 w-3 text-primary" />
          <span>Mercado: {formatNumber(d.marketDepleted)} un.</span>
        </div>
        <p className="text-muted-foreground">{pct}% do total</p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="skin-icon flex h-7 w-7 items-center justify-center rounded-lg">
                <LayoutGrid className="h-3.5 w-3.5" />
              </div>
              🏆 Ranking de Categorias
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              {categoryName ? `Sub-categorias de "${categoryName}"` : 'Categorias mais vendidas'} ·{' '}
              {MODE_LABELS[sortMode].toLowerCase()} · {days} dias
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="PieChartIcon"
              className="h-7 w-7"
              onClick={() => setViewMode((v) => (v === 'list' ? 'chart' : 'list'))}
              title={viewMode === 'list' ? 'Ver gráfico' : 'Ver lista'}
            >
              {viewMode === 'list' ? (
                <PieChartIcon className="h-3.5 w-3.5" />
              ) : (
                <BarChart3 className="h-3.5 w-3.5" />
              )}
            </Button>
            <ToggleGroup
              type="single"
              value={sortMode}
              onValueChange={(v) => v && setSortMode(v as SortMode)}
              className="rounded-lg bg-muted/50 p-0.5"
            >
              <ToggleGroupItem
                value="combined"
                className="h-6 px-2 py-1 text-[10px] data-[state=on]:bg-background data-[state=on]:shadow-sm"
              >
                Combinado
              </ToggleGroupItem>
              <ToggleGroupItem
                value="internal"
                className="h-6 gap-1 px-2 py-1 text-[10px] data-[state=on]:bg-background data-[state=on]:shadow-sm"
              >
                <TrendingUp className="h-2.5 w-2.5" />
                Interno
              </ToggleGroupItem>
              <ToggleGroupItem
                value="market"
                className="h-6 gap-1 px-2 py-1 text-[10px] data-[state=on]:bg-background data-[state=on]:shadow-sm"
              >
                <Store className="h-2.5 w-2.5" />
                Mercado
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <IntelligenceEmptyState
            title="Nenhuma categoria com vendas"
            description={
              categoryName
                ? `Não há sub-categorias com movimentação em "${categoryName}".`
                : 'Selecione um período mais amplo ou outros filtros.'
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'chart' ? (
              <motion.div
                key="chart"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="h-[320px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={1}
                      stroke="hsl(var(--background))"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltipContent />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      iconSize={8}
                      formatter={(value: string) => (
                        <span className="text-[10px] text-muted-foreground">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="space-y-2.5"
              >
                <TooltipProvider>
                  {sortedCategories.map((cat, i) => {
                    const val = getBarValue(cat);
                    const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                    return (
                      <Tooltip key={cat.categoryId}>
                        <TooltipTrigger asChild>
                          <div className="cursor-default space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <div className="mr-2 flex flex-1 items-center gap-2 truncate">
                                <span
                                  className={cn(
                                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                                    i < 3
                                      ? 'bg-primary/10 text-primary'
                                      : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  {i < 3 ? MEDAL_EMOJIS[i] : i + 1}
                                </span>
                                <span className="truncate text-xs font-medium">
                                  {cat.categoryName}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-2 text-right">
                                {sortMode !== 'market' && cat.marketDepleted > 0 && (
                                  <Badge variant="outline" className="gap-0.5 px-1 py-0 text-[9px]">
                                    <Store className="h-2.5 w-2.5" />
                                    {formatNumber(cat.marketDepleted)}
                                  </Badge>
                                )}
                                <span className="text-xs font-semibold text-foreground">
                                  {getDisplayValue(cat)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${pct}%`,
                                    background: `hsl(var(--primary) / ${getBarOpacity(i)})`,
                                  }}
                                />
                              </div>
                              <span className="w-24 shrink-0 text-right text-[9px] text-muted-foreground">
                                {formatNumber(cat.internalQty)} un. · {cat.internalOrders} ped.
                              </span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="space-y-1">
                          <p className="font-semibold">{cat.categoryName}</p>
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="h-3 w-3 text-success" />
                            <span>
                              Interno: {formatCurrency(cat.internalRevenue)} (
                              {formatNumber(cat.internalQty)} un.)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Store className="h-3 w-3 text-primary" />
                            <span>Mercado (saídas): {formatNumber(cat.marketDepleted)} un.</span>
                          </div>
                          <p className="text-muted-foreground">
                            Score: {cat.totalScore.toFixed(1)}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
