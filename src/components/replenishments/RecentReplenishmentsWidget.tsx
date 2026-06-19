import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, ChevronRight, Package, Building2 } from 'lucide-react';
import { useReplenishmentsWithDetails } from '@/hooks/products';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useMemo, useCallback } from 'react';

// ─── Helpers ─────────────────────────────────────────────────────

// Noon-anchored to match daysSinceLocal() in useReplenishments.ts — prevents
// UTC-midnight off-by-one when the user's local time crosses midnight in Brazil.
function daysSinceNoon(dateStr: string): number {
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;
  const [y, m, d] = parts;
  const restockNoon = new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
  const now = new Date();
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0).getTime();
  return Math.max(0, Math.round((todayNoon - restockNoon) / 86_400_000));
}

function formatDaysAgo(date: string): string {
  const days = daysSinceNoon(date);
  if (days === 0) return 'Hoje!';
  if (days === 1) return 'Ontem';
  return `${days}d atrás`;
}

type Recency = 'hot' | 'warm' | 'normal';

function getRecencyVariant(date: string): Recency {
  const days = daysSinceNoon(date);
  if (days <= 2) return 'hot';
  if (days <= 5) return 'warm';
  return 'normal';
}

const RECENCY_STYLES: Record<Recency, string> = {
  hot: 'text-info',
  warm: 'text-warning',
  normal: 'text-muted-foreground',
};

interface SupplierBreakdown {
  readonly id: string;
  readonly name: string;
  readonly count: number;
  readonly percentage: number;
}

// ─── Widget ──────────────────────────────────────────────────────

export function RecentReplenishmentsWidget() {
  const navigate = useNavigate();
  const { data: allItems, isLoading } = useReplenishmentsWithDetails();

  const recentItems = useMemo(() => {
    if (!allItems) return [];
    return [...allItems]
      .sort((a, b) => new Date(b.replenished_at).getTime() - new Date(a.replenished_at).getTime())
      .slice(0, 10);
  }, [allItems]);

  const supplierBreakdown = useMemo<readonly SupplierBreakdown[]>(() => {
    if (!allItems || allItems.length === 0) return [];
    const supMap = new Map<string, { id: string; name: string; count: number }>();
    for (const p of allItems) {
      if (p.supplier_id && p.supplier_name) {
        const existing = supMap.get(p.supplier_id);
        if (existing) existing.count++;
        else supMap.set(p.supplier_id, { id: p.supplier_id, name: p.supplier_name, count: 1 });
      }
    }
    const total = allItems.length;
    return [...supMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((s) => ({ ...s, percentage: Math.round((s.count / total) * 100) }));
  }, [allItems]);

  const handleClick = useCallback(
    (productId: string) => navigate(`/produto/${productId}`),
    [navigate],
  );

  return (
    <aside className="space-y-3" aria-label="Reposições recentes e fornecedores">
      {/* Recent Items Card */}
      <Card className="border-info/40 bg-gradient-to-br from-info/10 via-info/5 to-transparent shadow-[0_0_20px_hsl(var(--info)/0.15)] ring-1 ring-info/20">
        <CardHeader className="px-3 pb-1.5 pt-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <RefreshCw
              className="h-4 w-4 animate-pulse text-info drop-shadow-[0_0_6px_hsl(var(--info)/0.6)]"
              aria-hidden="true"
            />
            <span className="font-bold text-info">+ Recentes</span>
            {recentItems.length > 0 && (
              <Badge
                variant="secondary"
                className="border border-info/30 bg-info/20 px-1.5 py-0 text-[9px] font-bold tabular-nums text-info"
              >
                {recentItems.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0">
          {isLoading ? (
            <div
              className="flex flex-col items-center justify-center gap-2 py-6"
              role="status"
              aria-label="Carregando itens recentes"
            >
              <div
                className="h-4 w-4 animate-spin rounded-full border-2 border-primary/40 border-t-transparent"
                aria-hidden="true"
              />
              <span className="text-[10px] text-muted-foreground/50">carregando...</span>
            </div>
          ) : recentItems.length > 0 ? (
            <ScrollArea className="h-auto max-h-[280px]">
              <nav aria-label="Lista de produtos repostos recentemente">
                <ul className="space-y-1" role="list">
                  {recentItems.map((item, idx) => {
                    const isVeryNew = idx < 3;
                    const variant = getRecencyVariant(item.replenished_at);
                    return (
                      <li key={item.replenishment_id}>
                        <button
                          type="button"
                          className={cn(
                            'group flex w-full cursor-pointer items-center gap-2 rounded-md p-1.5 text-left',
                            'transition-all duration-150 hover:bg-info/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info',
                            isVeryNew
                              ? 'border border-info/20 bg-info/5 hover:border-info/40'
                              : 'border border-transparent',
                          )}
                          onClick={() => handleClick(item.product_id)}
                          aria-label={`${item.product_name} — reposto ${formatDaysAgo(item.replenished_at)}`}
                        >
                          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-muted">
                            {item.product_image ? (
                              <img
                                src={item.product_image}
                                alt=""
                                className="h-full w-full object-contain"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div
                                className="flex h-full w-full items-center justify-center text-muted-foreground/30"
                                aria-hidden="true"
                              >
                                <Package className="h-3 w-3" />
                              </div>
                            )}
                            {isVeryNew && (
                              <div className="absolute -right-0.5 -top-0.5" aria-hidden="true">
                                <RefreshCw className="h-2.5 w-2.5 text-info drop-shadow-[0_0_4px_hsl(var(--info)/0.5)]" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-[11px] font-medium transition-colors group-hover:text-primary">
                              {item.product_name}
                            </p>
                            <div className="flex items-center gap-1">
                              <RefreshCw
                                className={cn('h-2.5 w-2.5', RECENCY_STYLES[variant])}
                                aria-hidden="true"
                              />
                              <span
                                className={cn('text-[10px] font-medium', RECENCY_STYLES[variant])}
                              >
                                {formatDaysAgo(item.replenished_at)}
                              </span>
                            </div>
                          </div>
                          <ChevronRight
                            className="h-3 w-3 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary"
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </ScrollArea>
          ) : (
            <div className="py-4 text-center" role="status">
              <RefreshCw
                className="mx-auto mb-1.5 h-6 w-6 text-muted-foreground/30"
                aria-hidden="true"
              />
              <p className="text-[11px] text-muted-foreground">Nenhuma reposição recente</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier Breakdown Card */}
      {supplierBreakdown.length > 0 && (
        <Card className="border-info/30 bg-gradient-to-br from-info/5 to-transparent">
          <CardHeader className="px-3 pb-1.5 pt-3">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Building2 className="h-4 w-4 text-info" aria-hidden="true" />
              Por Fornecedor
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="space-y-2" role="list" aria-label="Reposições por fornecedor">
              {supplierBreakdown.map((sup, idx) => (
                <div key={sup.id} role="listitem">
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="max-w-[120px] truncate text-[11px] font-medium">
                      {sup.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="px-1 py-0 text-[9px] tabular-nums">
                        {sup.count}
                      </Badge>
                      <span className="w-7 text-right text-[9px] tabular-nums text-muted-foreground">
                        {sup.percentage}%
                      </span>
                    </div>
                  </div>
                  <div
                    className="h-1 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={sup.percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${sup.name}: ${sup.percentage}%`}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700 ease-out',
                        idx === 0 ? 'bg-info' : 'bg-info/50',
                      )}
                      style={{ width: `${sup.percentage}%` }}
                    />
                  </div>
                  {idx < supplierBreakdown.length - 1 && <Separator className="mt-2 opacity-20" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </aside>
  );
}
