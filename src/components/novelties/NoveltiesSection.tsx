import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, CalendarRange, ChevronRight, Package, Building2, Flame } from 'lucide-react';
import {
  useNoveltiesWithDetails,
  useNoveltyStats,
  type NoveltyStatsDisplay,
} from '@/hooks/products';
import { NoveltyBadge } from '@/components/products/NoveltyBadge';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

function formatDaysAgo(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days === 0) return 'Hoje!';
  if (days === 1) return 'Ontem';
  return `${days}d atrás`;
}

export function NoveltiesSection() {
  const navigate = useNavigate();
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');

  const { data: allNovelties, isLoading } = useNoveltiesWithDetails({ limit: 100 });
  const { data: stats } = useNoveltyStats() as { data: NoveltyStatsDisplay | undefined };

  // Extract unique suppliers from data
  const suppliers = useMemo(() => {
    if (!allNovelties) return [];
    const supMap = new Map<string, { id: string; name: string; count: number }>();
    allNovelties.forEach((p) => {
      if (p.supplier_id && p.supplier_name) {
        const existing = supMap.get(p.supplier_id);
        if (existing) existing.count++;
        else supMap.set(p.supplier_id, { id: p.supplier_id, name: p.supplier_name, count: 1 });
      }
    });
    return [...supMap.values()].sort((a, b) => b.count - a.count);
  }, [allNovelties]);

  // Filter by period and supplier
  const novelties = useMemo(() => {
    if (!allNovelties) return [];
    let filtered = [...allNovelties];

    if (periodFilter !== 'all') {
      const maxDays = parseInt(periodFilter);
      filtered = filtered.filter((p) => {
        const elapsed = Math.floor((Date.now() - new Date(p.detected_at).getTime()) / 86400000);
        return elapsed <= maxDays;
      });
    }

    if (selectedSupplier !== 'all') {
      filtered = filtered.filter((p) => p.supplier_id === selectedSupplier);
    }

    return filtered
      .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())
      .slice(0, 8);
  }, [allNovelties, periodFilter, selectedSupplier]);

  const handleProductClick = (productId: string) => {
    navigate(`/produto/${productId}`);
  };

  const hasFilters = periodFilter !== 'all' || selectedSupplier !== 'all';

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-success to-success/80 p-2 text-success-foreground shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                Novidades
                {stats && (
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    {stats.activeNovelties} produtos
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Lançamentos recentes dos fornecedores</CardDescription>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="h-9 w-[130px] text-xs">
                <CalendarRange className="mr-1 h-3 w-3" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger className="h-9 w-[160px] text-xs">
                <Building2 className="mr-1 h-3 w-3" />
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos fornecedores</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mini stats row */}
        {stats && (
          <div className="mt-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-brand-primary">
              <Flame className="h-4 w-4" />
              <span className="font-semibold tabular-nums">{stats.arrivedToday}</span>
              <span className="text-xs text-muted-foreground">hoje</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-success">
              <CalendarRange className="h-4 w-4" />
              <span className="font-semibold tabular-nums">{stats.arrivedThisWeek}</span>
              <span className="text-xs text-muted-foreground">esta semana</span>
            </div>
            {stats.topSupplierName && (
              <>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-1.5 text-info">
                  <Building2 className="h-4 w-4" />
                  <span className="font-semibold">{stats.topSupplierName}</span>
                  <span className="text-xs text-muted-foreground">({stats.topSupplierCount})</span>
                </div>
              </>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-3">
                  <Skeleton className="mb-3 aspect-square rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : novelties.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {novelties.map((item, index) => {
                const fresh =
                  Math.floor((Date.now() - new Date(item.detected_at).getTime()) / 86400000) <= 2;
                return (
                  <Card
                    key={item.novelty_id}
                    className={cn(
                      'group cursor-pointer overflow-hidden transition-all duration-300',
                      'border-border/50 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg',
                      fresh && 'border-success/30 shadow-[0_0_12px_hsl(var(--success)/0.08)]',
                      'stagger-item',
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => handleProductClick(item.product_id)}
                  >
                    <CardContent className="p-0">
                      {/* Image */}
                      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted/50 to-muted/30">
                        {item.product_image ? (
                          <img
                            src={item.product_image}
                            alt={item.product_name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-10 w-10 text-muted-foreground/20" />
                          </div>
                        )}
                        <div className="absolute left-2 top-2">
                          <NoveltyBadge
                            daysRemaining={item.days_remaining}
                            daysElapsed={item.days_as_novelty}
                            size="sm"
                          />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="space-y-1.5 p-3">
                        <h4 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium transition-colors group-hover:text-primary">
                          {item.product_name}
                        </h4>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className={cn(fresh ? 'font-medium text-brand-primary' : '')}>
                            {formatDaysAgo(item.detected_at)}
                          </span>
                          {item.supplier_name && (
                            <span className="ml-1 max-w-[80px] truncate">{item.supplier_name}</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* CTA */}
            <div className="mt-6 flex justify-center">
              <Button variant="outline" className="gap-2" onClick={() => navigate('/novidades')}>
                Ver todas as novidades
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="py-12 text-center">
            <Sparkles className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              {hasFilters ? 'Nenhuma novidade com esses filtros' : 'Nenhuma novidade encontrada'}
            </p>
            {hasFilters && (
              <Button
                variant="link"
                className="mt-2"
                onClick={() => {
                  setPeriodFilter('all');
                  setSelectedSupplier('all');
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
