/**
 * IndustryTrendingProducts — Zona 3: tendências do setor (cross-vendedor).
 * Sprint 2: gap analysis ("cliente já compra?") + filtro "só oportunidades" +
 * top 3 oportunidades como hero cards com projeção de receita.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  TrendingUp,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
  CheckCircle2,
  Package,
  Target,
  Check,
  X,
} from 'lucide-react';
import { useIndustryTrends } from '@/hooks/bi/useIndustryTrends';
import { useClientAffinity } from '@/hooks/bi/useClientAffinity';
import { ProductGridSkeleton } from '@/components/bi/BISkeletons';
import { resolveBICategory, resolveBICategoryLabel } from '@/lib/bi/categoryResolver';
import { useBICategoryFocus } from '@/contexts/BICategoryFocusContext';
import { cn } from '@/lib/utils';

interface Props {
  ramoAtividade: string | null;
  clientId: string;
}

const trendIcon = {
  up: { icon: ArrowUp, className: 'text-success' },
  stable: { icon: Minus, className: 'text-muted-foreground' },
  down: { icon: ArrowDown, className: 'text-destructive' },
};

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function IndustryTrendingProducts({ ramoAtividade, clientId }: Props) {
  const { data, isLoading } = useIndustryTrends(ramoAtividade);
  const { data: affinity } = useClientAffinity(clientId);
  const { focusedSlug, focusedLabel } = useBICategoryFocus();
  const [onlyOpportunities, setOnlyOpportunities] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const effectiveCategory = focusedLabel ?? activeCategory;

  // Set de assinaturas dos produtos que o cliente já compra (por id e por nome normalizado)
  const clientBuys = useMemo(() => {
    const ids = new Set<string>();
    const names = new Set<string>();
    affinity?.topProducts?.forEach((p) => {
      if (p.product_id) ids.add(p.product_id);
      if (p.product_name) names.add(normalize(p.product_name));
    });
    return { ids, names };
  }, [affinity]);

  // Categorias presentes (chips) — derivadas via resolver central
  const categoryChips = useMemo(() => {
    const counts = new Map<string, number>();
    (data?.trends ?? []).forEach((t) => {
      const cat = resolveBICategoryLabel(t.productName, t.category);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));
  }, [data]);

  const enriched = useMemo(() => {
    const items = (data?.trends ?? []).map((t) => {
      const alreadyBuys =
        (t.productId && clientBuys.ids.has(t.productId)) ||
        clientBuys.names.has(normalize(t.productName));
      const meta = resolveBICategory(t.productName, t.category);
      return { ...t, alreadyBuys, resolvedCategory: meta.label, resolvedSlug: meta.slug };
    });
    let filtered = onlyOpportunities ? items.filter((t) => !t.alreadyBuys) : items;
    if (focusedSlug) {
      filtered = filtered.filter((t) => t.resolvedSlug === focusedSlug);
    } else if (effectiveCategory) {
      filtered = filtered.filter((t) => t.resolvedCategory === effectiveCategory);
    }
    return { items, filtered };
  }, [data, clientBuys, onlyOpportunities, effectiveCategory, focusedSlug]);

  const opportunities = enriched.items.filter((t) => !t.alreadyBuys);
  const topOpportunities = opportunities.slice(0, 3);
  const opportunityCount = opportunities.length;
  const totalCount = enriched.items.length;

  if (isLoading) return <ProductGridSkeleton rows={5} />;

  return (
    <Card className="border-[1.5px]">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10">
              <TrendingUp className="h-4 w-4 text-info" />
            </div>
            <div>
              <h2 className="font-display font-semibold">
                Tendência do setor
                {ramoAtividade && (
                  <span className="font-normal text-muted-foreground"> · {ramoAtividade}</span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                {data?.isMock
                  ? 'Top produtos dos últimos 90 dias · setor'
                  : `Agregado de ${data?.companiesInRamo} empresas do mesmo ramo · 90 dias`}
                {totalCount > 0 && (
                  <>
                    {' · '}
                    <span className="font-medium text-success">
                      {opportunityCount} oportunidade{opportunityCount !== 1 && 's'}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {totalCount > 0 && (
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <Switch
                  checked={onlyOpportunities}
                  onCheckedChange={setOnlyOpportunities}
                  aria-label="Mostrar apenas oportunidades"
                />
                <span className="font-medium text-foreground">Só oportunidades</span>
              </label>
            )}
            {data &&
              (data.isMock ? (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Sparkles className="h-3 w-3" /> Simulado
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 border-success/50 text-[10px] text-success"
                >
                  <CheckCircle2 className="h-3 w-3" /> Dados reais
                </Badge>
              ))}
          </div>
        </div>

        {/* Chips de categoria — protagonismo do eixo categoria */}
        {categoryChips.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Categorias:
            </span>
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                activeCategory === null
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted',
              )}
            >
              Todas ({totalCount})
            </button>
            {categoryChips.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setActiveCategory(c.label === activeCategory ? null : c.label)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  activeCategory === c.label
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:bg-muted',
                )}
              >
                {c.label} ({c.count})
              </button>
            ))}
          </div>
        )}

        {/* Top 3 oportunidades como hero cards */}
        {topOpportunities.length > 0 && !onlyOpportunities && (
          <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-3">
            {topOpportunities.map((t, i) => {
              // Projeção: ticket médio do setor × 3 (ciclo trimestre)
              const projectedRevenue =
                t.avgPrice * Math.max(t.unitsSold / Math.max(t.ordersCount, 1), 1) * 3;
              return (
                <div
                  key={`hero-${i}`}
                  className="relative rounded-xl border-[1.5px] border-success/30 bg-success/5 p-3 transition-all hover:border-success/50 hover:shadow-md"
                >
                  <Badge className="absolute right-2 top-2 gap-1 bg-success text-[10px] text-success-foreground">
                    <Target className="h-3 w-3" /> Oportunidade
                  </Badge>
                  <div className="flex gap-3">
                    {t.imageUrl ? (
                      <img
                        src={t.imageUrl}
                        alt={t.productName}
                        loading="lazy"
                        className="h-16 w-16 shrink-0 rounded-lg border bg-background object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted/40">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 pt-4">
                      <div className="line-clamp-2 text-sm font-semibold leading-tight">
                        {t.productName}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{t.category}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-success/20 pt-2 text-[11px]">
                    <div>
                      <div className="text-muted-foreground">Ticket setor</div>
                      <div className="font-bold text-foreground">{fmtBRL(t.avgPrice)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Projeção 90d</div>
                      <div className="font-bold text-success">{fmtBRL(projectedRevenue)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!enriched.filtered.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {onlyOpportunities
              ? 'Cliente já compra todos os top produtos do setor 🎉'
              : 'Sem dados de tendência para este ramo.'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {enriched.filtered.map((t, i) => {
              const Trend = trendIcon[t.trend];
              return (
                <div
                  key={`${t.productName}-${i}`}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/60',
                    t.alreadyBuys && 'opacity-90',
                  )}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted font-display text-xs font-bold text-muted-foreground">
                    {i + 1}
                  </div>
                  {t.imageUrl ? (
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-muted/40">
                      <img
                        src={t.imageUrl}
                        alt={t.productName}
                        loading="lazy"
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/40">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.productName}</div>
                    <div className="text-xs text-muted-foreground">{t.category}</div>
                  </div>

                  {/* Status: cliente já compra? */}
                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                    {t.alreadyBuys ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-success/40 text-[10px] text-success"
                      >
                        <Check className="h-3 w-3" /> Já compra
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="gap-1 border-warning/40 text-[10px] text-warning"
                      >
                        <X className="h-3 w-3" /> Gap
                      </Badge>
                    )}
                  </div>

                  <div className="hidden shrink-0 text-right md:block">
                    <div className="text-xs text-muted-foreground">unidades</div>
                    <div className="text-sm font-semibold">
                      {t.unitsSold.toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right lg:block">
                    <div className="text-xs text-muted-foreground">preço médio</div>
                    <div className="text-sm font-semibold">{fmtBRL(t.avgPrice)}</div>
                  </div>
                  <Trend.icon className={cn('h-4 w-4 shrink-0', Trend.className)} />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
