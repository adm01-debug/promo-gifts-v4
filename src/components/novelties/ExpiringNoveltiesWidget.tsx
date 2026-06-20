import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Flame, Sparkles, ChevronRight, Package, Building2, Hourglass } from 'lucide-react';
import { useExpiringNovelties, useNoveltiesWithDetails, useNoveltyStats } from '@/hooks/products';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useMemo, useState, useEffect } from 'react';
import { formatDaysAgoFromTs, getRecencyVariant } from '@/lib/novelty-dates';

/** Rótulo curto de quanto tempo resta como novidade. */
function formatDaysLeft(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'Expira hoje';
  if (daysRemaining === 1) return 'Resta 1 dia';
  return `Restam ${daysRemaining} dias`;
}

const recencyStyles = {
  hot: 'text-brand-primary',
  warm: 'text-warning',
  normal: 'text-muted-foreground',
};

interface SupplierBreakdown {
  id: string;
  name: string;
  count: number;
  percentage: number;
}

export function ExpiringNoveltiesWidget() {
  const navigate = useNavigate();
  // GAP-FIX: remover limit:200 compartilha a cache key ['novelties-details','all',false] com
  // NoveltyProductGrid — elimina a segunda round-trip ao servidor. O componente usa apenas
  // os top-10 mais recentes, mas o React Query devolve os dados já carregados pelo grid.
  const { data: allNovelties, isLoading } = useNoveltiesWithDetails();

  // ISSUE-34 FIX: tick a cada 60s para recalcular recência — sem isso, uma
  // novidade detectada "há 2 dias" continuaria mostrando badge 'hot' enquanto a
  // página fica aberta, mesmo depois de virar 'warm' (dias 3-5).
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Novidades que estão prestes a sair da janela (≤ 7 dias restantes). Fonte:
  // expiração REAL da pipeline (novelty_expires_at). Renderizado só quando há
  // itens — sem ruído quando nada está expirando.
  const { data: expiring = [] } = useExpiringNovelties(7);
  const expiringItems = useMemo(() => expiring.slice(0, 8), [expiring]);

  const recentItems = useMemo(() => {
    if (!allNovelties) return [];
    return [...allNovelties]
      .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())
      .slice(0, 10);
  }, [allNovelties]);

  // FIX (auditoria Novidades, P1-A): o ranking "Por Fornecedor" vem agora do
  // useNoveltyStats — calculado server-side sobre TODAS as novidades da janela
  // (nao sobre os 200 itens carregados aqui). Antes este painel contradizia o
  // card "Top Fornecedor" (ex.: dizia "Só Marcas 54%" quando a verdade, sobre o
  // conjunto completo, era "XBZ 58%"). Fonte de verdade unica.
  const { data: noveltyStats } = useNoveltyStats();
  const supplierBreakdown: SupplierBreakdown[] = (noveltyStats?.supplierBreakdown ?? []).slice(
    0,
    5,
  );

  const handleClick = (productId: string) => {
    navigate(`/produto/${productId}`);
  };

  return (
    <div className="space-y-3">
      {/* Expirando em breve — só aparece quando há novidades saindo da janela */}
      {expiringItems.length > 0 && (
        <Card className="border-warning/40 bg-gradient-to-br from-warning/10 via-warning/5 to-transparent ring-1 ring-warning/20">
          <CardHeader className="px-3 pb-1.5 pt-3">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Hourglass className="h-4 w-4 text-warning" />
              <span className="font-bold text-warning">Expirando em breve</span>
              <Badge
                variant="secondary"
                className="border border-warning/30 bg-warning/20 px-1.5 py-0 text-[9px] font-bold tabular-nums text-warning"
              >
                {expiringItems.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <ScrollArea className="h-auto max-h-[220px]">
              <div className="space-y-1">
                {expiringItems.map((item) => (
                  <button
                    type="button"
                    key={item.novelty_id}
                    aria-label={`Abrir produto ${item.product_name}`}
                    className="group flex w-full items-center gap-2 rounded-md border border-warning/20 bg-warning/5 p-1.5 text-left transition-all duration-150 hover:border-warning/40 hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
                    onClick={() => handleClick(item.product_id)}
                  >
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-muted">
                      {item.product_image ? (
                        <img
                          src={item.product_image}
                          alt={item.product_name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                          <Package className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[11px] font-medium transition-colors group-hover:text-primary">
                        {item.product_name}
                      </p>
                      <div className="flex items-center gap-1">
                        <Hourglass className="h-2.5 w-2.5 text-warning" />
                        <span className="text-[10px] font-medium text-warning">
                          {formatDaysLeft(item.days_remaining)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-warning" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* + Recentes widget */}
      <Card className="border-success/40 bg-gradient-to-br from-success/10 via-success/5 to-transparent shadow-[0_0_20px_hsl(var(--success)/0.15)] ring-1 ring-success/20">
        <CardHeader className="px-3 pb-1.5 pt-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Flame className="h-4 w-4 animate-pulse text-success drop-shadow-[0_0_6px_hsl(var(--success)/0.6)]" />
            <span className="font-bold text-success">+ Recentes</span>
            {recentItems.length > 0 && (
              <Badge
                variant="secondary"
                className="border border-success/30 bg-success/20 px-1.5 py-0 text-[9px] font-bold tabular-nums text-success"
              >
                {recentItems.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="px-3 pb-3 pt-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/40 border-t-transparent" />
              <span className="text-[10px] text-muted-foreground/50">carregando...</span>
            </div>
          ) : recentItems.length > 0 ? (
            <ScrollArea className="h-auto max-h-[280px]">
              <div className="space-y-1">
                {recentItems.map((item, idx) => {
                  const isVeryNew = idx < 3;
                  const variant = getRecencyVariant(item.detected_at);
                  return (
                    <div
                      key={item.novelty_id}
                      className={cn(
                        'group flex cursor-pointer items-center gap-2 rounded-md p-1.5',
                        'transition-all duration-150 hover:bg-success/10',
                        isVeryNew
                          ? 'border border-success/20 bg-success/5 hover:border-success/40'
                          : 'border border-transparent',
                      )}
                      onClick={() => handleClick(item.product_id)}
                    >
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-muted">
                        {item.product_image ? (
                          <img
                            src={item.product_image}
                            alt={item.product_name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                            <Package className="h-3 w-3" />
                          </div>
                        )}
                        {isVeryNew && (
                          <div className="absolute -right-0.5 -top-0.5">
                            <Flame className="h-2.5 w-2.5 text-success drop-shadow-[0_0_4px_hsl(var(--success)/0.5)]" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[11px] font-medium transition-colors group-hover:text-primary">
                          {item.product_name}
                        </p>
                        <div className="flex items-center gap-1">
                          <Sparkles className={cn('h-2.5 w-2.5', recencyStyles[variant])} />
                          <span className={cn('text-[10px] font-medium', recencyStyles[variant])}>
                            {formatDaysAgoFromTs(item.detected_at)}
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-4 text-center">
              <Sparkles className="mx-auto mb-1.5 h-6 w-6 text-muted-foreground/30" />
              <p className="text-[11px] text-muted-foreground">Nenhuma novidade recente</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier Breakdown widget */}
      {supplierBreakdown.length > 0 && (
        <Card className="border-info/30 bg-gradient-to-br from-info/5 to-transparent">
          <CardHeader className="px-3 pb-1.5 pt-3">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Building2 className="h-4 w-4 text-info" />
              Por Fornecedor
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="space-y-2">
              {supplierBreakdown.map((sup, idx) => (
                <div key={sup.id}>
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
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
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
    </div>
  );
}
