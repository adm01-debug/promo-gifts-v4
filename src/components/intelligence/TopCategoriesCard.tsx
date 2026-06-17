/**
 * TopCategoriesCard — categorias em alta extraídas da tabela `product_views`
 * via prefixo de SKU/nome. Aplica trending score.
 */
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Layers, TrendingUp, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';
import { calculateTrendingScore } from '@/lib/trending-score';

interface TopCategoriesCardProps {
  days: number;
}

interface CategoryRow {
  category: string;
  views: number;
  recentViews: number;
  baselineViews: number;
  trendingScore: number;
  classification: 'rising' | 'stable' | 'falling' | 'new';
  growthPercent: number;
}

/**
 * Heurística para extrair categoria de um nome de produto.
 * Pega a primeira palavra significativa. (Ex: "Caneta Premium" -> "Caneta")
 */
function extractCategory(name: string | null | undefined): string {
  if (!name) return 'Outros';
  const words = name.trim().split(/\s+/);
  return words[0] || 'Outros';
}

export function TopCategoriesCard({ days }: TopCategoriesCardProps) {
  const recentDays = Math.max(Math.floor(days / 3), 1);
  const baselineDays = days - recentDays;
  const sinceCurrent = subDays(new Date(), days).toISOString();
  const recentCutoff = subDays(new Date(), recentDays).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['trends-top-categories', days],
    queryFn: async (): Promise<CategoryRow[]> => {
      const { isDemoMode, MOCK_TOP_CATEGORIES } = await import('@/pages/trends/trends-mock');
      if (isDemoMode()) {
        return MOCK_TOP_CATEGORIES.map((c, idx) => ({
          category: c.category,
          views: c.views,
          recentViews: Math.round(c.views * 0.42),
          baselineViews: Math.round(c.views * 0.58),
          trendingScore: 2 + (MOCK_TOP_CATEGORIES.length - idx) * 0.3,
          classification:
            idx < 3 ? 'rising' : idx === MOCK_TOP_CATEGORIES.length - 1 ? 'new' : 'stable',
          growthPercent: [142, 98, 67, 32, 18, 0][idx] ?? 0,
        }));
      }
      const { data, error } = await supabase
        .from('product_views')
        .select('product_name, created_at')
        .gte('created_at', sinceCurrent);
      if (error) throw error;

      const map = new Map<string, { views: number; recent: number }>();
      (data ?? []).forEach((v: { product_name: string | null; created_at: string }) => {
        const cat = extractCategory(v.product_name);
        const existing = map.get(cat) ?? { views: 0, recent: 0 };
        existing.views += 1;
        if (v.created_at >= recentCutoff) existing.recent += 1;
        map.set(cat, existing);
      });

      const rows: CategoryRow[] = Array.from(map.entries()).map(([cat, agg]) => {
        const baseline = agg.views - agg.recent;
        const score = calculateTrendingScore({
          recentCount: agg.recent,
          baselineCount: baseline,
          recentDays,
          baselineDays,
          totalVolume: agg.views,
        });
        return {
          category: cat,
          views: agg.views,
          recentViews: agg.recent,
          baselineViews: baseline,
          trendingScore: score.score,
          classification: score.classification,
          growthPercent: score.growthPercent,
        };
      });

      return rows
        .filter((r) => r.views >= 2)
        .sort(
          (a, b) =>
            b.trendingScore * Math.log(b.views + 1) - a.trendingScore * Math.log(a.views + 1),
        )
        .slice(0, 8);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-chart-4" />
          Categorias em Alta
        </CardTitle>
        <CardDescription>
          Ranqueado por crescimento (não só volume) nos últimos {days} dias
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Ainda não há dados suficientes para ranquear categorias
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((row, i) => (
              <div
                key={row.category}
                className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5 transition-colors hover:bg-muted/60"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-chart-4/15 text-xs font-bold text-chart-4">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-foreground">{row.category}</p>
                    {row.classification === 'rising' && Number.isFinite(row.growthPercent) && (
                      <Badge
                        variant="outline"
                        className="h-4 shrink-0 border-success/30 bg-success/10 px-1 text-[9px] text-success"
                      >
                        <TrendingUp className="mr-0.5 h-2.5 w-2.5" />+
                        {Math.round(row.growthPercent)}%
                      </Badge>
                    )}
                    {row.classification === 'new' && (
                      <Badge
                        variant="outline"
                        className="h-4 shrink-0 border-primary/30 bg-primary/10 px-1 text-[9px] text-primary"
                      >
                        <Sparkles className="mr-0.5 h-2.5 w-2.5" />
                        NOVO
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {row.recentViews} recentes · {row.baselineViews} baseline
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {row.views}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
