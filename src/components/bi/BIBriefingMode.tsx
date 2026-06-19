/**
 * BIBriefingMode — view compacta "1 página pré-reunião".
 * Health Score grande + 3 talking points + 5 produtos + script de abertura.
 * Otimizado para leitura mobile; aciona via botão "Modo briefing" no header.
 */
import { useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Phone,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Calendar,
  MessageSquare,
  Copy,
  Package,
  Layers,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientHealthScore } from '@/hooks/bi/useClientHealthScore';
import { useClientBI } from '@/hooks/bi/useClientBI';
import { useClientAffinity } from '@/hooks/bi/useClientAffinity';
import { useIndustryTrends } from '@/hooks/bi/useIndustryTrends';
import { useClientCategoryAffinity } from '@/hooks/bi/useClientCategoryAffinity';
import { useIndustryCategoryTrends } from '@/hooks/bi/useIndustryCategoryTrends';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  ramoAtividade: string | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function BIBriefingMode({ open, onOpenChange, clientId, clientName, ramoAtividade }: Props) {
  const health = useClientHealthScore(clientId, ramoAtividade);
  const bi = useClientBI(clientId);
  const affinity = useClientAffinity(clientId);
  const trends = useIndustryTrends(ramoAtividade);
  const catAffinity = useClientCategoryAffinity(clientId);
  const catIndustry = useIndustryCategoryTrends(ramoAtividade);

  // Top 2 categorias favoritas + 1 oportunidade GAP (setor compra muito, cliente nada)
  const categoryHighlights = useMemo(() => {
    const favorites = catAffinity.categories.slice(0, 2).map((c) => ({
      label: c.label,
      sharePct: Math.round(c.revenueSharePct),
      trend: c.trend,
      deltaPct: c.deltaPct,
    }));
    const clientSlugs = new Set(catAffinity.categories.map((c) => c.slug));
    const gap = catIndustry.categories.find(
      (ind) => !clientSlugs.has(ind.slug) && ind.revenueSharePct >= 8,
    );
    return {
      favorites,
      gap: gap ? { label: gap.label, sharePct: Math.round(gap.revenueSharePct) } : null,
    };
  }, [catAffinity.categories, catIndustry.categories]);

  const tierStyles = useMemo(() => {
    switch (health.tier) {
      case 'healthy':
        return {
          color: 'text-emerald-600 dark:text-emerald-400',
          bg: 'bg-emerald-500/10',
          icon: CheckCircle2,
          label: 'Saudável',
        };
      case 'attention':
        return {
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-500/10',
          icon: AlertTriangle,
          label: 'Atenção',
        };
      case 'risk':
        return {
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-500/10',
          icon: AlertTriangle,
          label: 'Risco',
        };
      case 'unknown':
      default:
        return { color: 'text-muted-foreground', bg: 'bg-muted', icon: Sparkles, label: '—' };
    }
  }, [health.tier]);

  const TierIcon = tierStyles.icon;

  // 3 talking points
  const talkingPoints = useMemo(() => {
    const pts: Array<{ icon: typeof TrendingUp; label: string; detail: string }> = [];
    pts.push({ icon: tierStyles.icon, label: 'Saúde', detail: health.crossZoneInsight });
    if (health.windowLabel) {
      pts.push({ icon: Calendar, label: 'Janela', detail: health.windowLabel });
    }
    if (health.shareOfWalletPct < 30 && health.potentialUntappedBRL > 10000) {
      pts.push({
        icon: TrendingUp,
        label: 'Oportunidade',
        detail: `Share-of-wallet ${health.shareOfWalletPct}% · potencial não capturado de ${fmtBRL(health.potentialUntappedBRL)}.`,
      });
    } else {
      pts.push({
        icon: TrendingUp,
        label: 'Histórico',
        detail: `LTV ${fmtBRL(bi.ltv)} em ${bi.ordersCount} pedidos · ticket médio ${fmtBRL(bi.avgTicket)}.`,
      });
    }
    return pts.slice(0, 3);
  }, [health, bi, tierStyles.icon]);

  // 5 produtos sugeridos
  const products = useMemo(() => {
    const list: Array<{
      name: string;
      reason: string;
      image: string | null;
      source: 'afinidade' | 'setor';
    }> = [];
    affinity.data?.categories?.flatMap((c) =>
      c.suggestions.slice(0, 1).map((s) =>
        list.push({
          name: s.name,
          reason: s.reason,
          image: s.imageUrl ?? null,
          source: 'afinidade',
        }),
      ),
    );
    (trends.data?.trends ?? []).slice(0, 5).forEach((t) => {
      if (!list.find((p) => p.name.toLowerCase() === t.productName.toLowerCase())) {
        list.push({
          name: t.productName,
          reason: `Top ${t.category} no setor`,
          image: t.imageUrl ?? null,
          source: 'setor',
        });
      }
    });
    return list.slice(0, 5);
  }, [affinity.data, trends.data]);

  const summaryText = useMemo(() => {
    const catLines: string[] = [];
    if (categoryHighlights.favorites.length > 0) {
      catLines.push(`🏷️ Categorias favoritas:`);
      categoryHighlights.favorites.forEach((f) => {
        const trendStr =
          f.trend === 'up' && f.deltaPct !== null
            ? ` (↑${Math.round(f.deltaPct)}% vs 90d ant.)`
            : f.trend === 'down' && f.deltaPct !== null
              ? ` (↓${Math.round(f.deltaPct)}% vs 90d ant.)`
              : '';
        catLines.push(`  • ${f.label} — ${f.sharePct}% das compras${trendStr}`);
      });
    }
    if (categoryHighlights.gap) {
      catLines.push(
        `🎯 Oportunidade GAP: ${categoryHighlights.gap.label} — setor compra ${categoryHighlights.gap.sharePct}%, esse cliente ainda não.`,
      );
    }

    return [
      `📋 BRIEFING — ${clientName}`,
      `Score de saúde: ${health.score}/100 (${tierStyles.label})`,
      ``,
      `Diagnóstico: ${health.crossZoneInsight}`,
      ``,
      ...(catLines.length > 0 ? [...catLines, ``] : []),
      `Próxima ação: ${health.nextActionLabel}`,
      `Detalhe: ${health.nextActionDetail}`,
      `Janela ideal: ${health.windowLabel}`,
      ``,
      `📞 Script de abertura:`,
      `"${health.scriptHint}"`,
      ``,
      `🎯 Produtos para apresentar:`,
      ...products.map((p, i) => `  ${i + 1}. ${p.name} (${p.source})`),
    ].join('\n');
  }, [clientName, health, products, tierStyles.label, categoryHighlights]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      toast.success('Briefing copiado! Cole no WhatsApp ou e-mail.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b p-5 pb-3">
          <SheetTitle className="flex items-center gap-2 font-display">
            <MessageSquare className="h-5 w-5 text-primary" />
            Briefing pré-reunião
          </SheetTitle>
          <SheetDescription className="text-xs">
            Tudo que você precisa saber sobre <strong>{clientName}</strong> em 1 página.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-5 p-5">
            {/* Score hero */}
            <div className={cn('flex items-center gap-4 rounded-2xl p-4', tierStyles.bg)}>
              <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border-[1.5px] bg-background/80 shadow-sm">
                <span
                  className={cn('font-display text-3xl font-bold leading-none', tierStyles.color)}
                >
                  {health.score}
                </span>
                <span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                  Score
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <Badge
                  variant="outline"
                  className={cn('mb-2 border-0', tierStyles.bg, tierStyles.color)}
                >
                  <TierIcon className="mr-1 h-3 w-3" />
                  {tierStyles.label}
                </Badge>
                <p className="text-xs leading-relaxed text-foreground/90">
                  {health.crossZoneInsight}
                </p>
              </div>
            </div>

            {/* Categorias-chave (eixo CATEGORIA) */}
            {(categoryHighlights.favorites.length > 0 || categoryHighlights.gap) && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Layers className="h-3 w-3" /> Categorias-chave
                </h4>
                <div className="space-y-1.5">
                  {categoryHighlights.favorites.map((f, i) => (
                    <div
                      key={`fav-${i}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge className="h-4 shrink-0 bg-emerald-600 text-[9px] text-white">
                          {i === 0 ? 'Favorita' : `Top ${i + 1}`}
                        </Badge>
                        <span className="truncate text-xs font-medium">{f.label}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-xs font-semibold tabular-nums">{f.sharePct}%</span>
                        {f.trend === 'up' && f.deltaPct !== null && (
                          <span className="text-[10px] tabular-nums text-emerald-600 dark:text-emerald-400">
                            ↑{Math.round(f.deltaPct)}%
                          </span>
                        )}
                        {f.trend === 'down' && f.deltaPct !== null && (
                          <span className="text-[10px] tabular-nums text-red-600 dark:text-red-400">
                            ↓{Math.round(f.deltaPct)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {categoryHighlights.gap && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge className="h-4 shrink-0 gap-0.5 bg-violet-600 text-[9px] text-white">
                          <Target className="h-2.5 w-2.5" />
                          GAP
                        </Badge>
                        <span className="truncate text-xs font-medium">
                          {categoryHighlights.gap.label}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] text-violet-700 dark:text-violet-300">
                        Setor: {categoryHighlights.gap.sharePct}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                3 talking points
              </h4>
              {talkingPoints.map((tp, i) => {
                const Icon = tp.icon;
                return (
                  <div key={i} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold">{tp.label}</div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {tp.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator />

            {/* Script */}
            <div className="space-y-2">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Phone className="h-3 w-3" /> Script de abertura
              </h4>
              <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-3">
                <p className="text-sm italic leading-relaxed">"{health.scriptHint}"</p>
              </div>
            </div>

            <Separator />

            {/* 5 produtos */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                5 produtos para apresentar
              </h4>
              <div className="space-y-1.5">
                {products.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
                      {i + 1}
                    </div>
                    {p.image ? (
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-muted">
                        <img
                          src={p.image}
                          alt={p.name}
                          loading="lazy"
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{p.name}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{p.reason}</div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 border-0 text-[9px]',
                        p.source === 'afinidade'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                      )}
                    >
                      {p.source}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="border-t bg-card p-4">
          <Button onClick={handleCopy} className="w-full gap-2">
            <Copy className="h-4 w-4" />
            Copiar briefing para WhatsApp
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
