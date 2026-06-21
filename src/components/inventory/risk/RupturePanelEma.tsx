/**
 * RupturePanelEma — Painel "Risco por Fornecedor (EMA)".
 * Consome `mv_stock_rupture_alert` + `fn_ema_kpi_by_level` do canônico.
 * Render condicional pela flag `useEmaRupture`.
 *
 * Onda 1:
 * - Aceita prop `focusedLevel` do StockHeroRiskBanner (filtra nível automaticamente)
 * - Botão "Pedir Reposição" em cada linha → PurchaseOrderModal
 * - supplier_sku exibido em vez de variant_id truncado
 * - stock_total corrigido (era current_stock, coluna não existe na MV)
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, TrendingDown, Activity, Info, ShoppingCart } from 'lucide-react';
import { isFeatureEnabled } from '@/lib/feature-flags';
import {
  useRuptureAlerts,
  type RuptureAlertRow,
  type RuptureLevel,
} from '@/hooks/stock/useRuptureAlerts';
import { useRuptureKpiSummary } from '@/hooks/stock/useRuptureKpiSummary';
import { RuptureLevelBadge } from './RuptureLevelBadge';
import { PurchaseOrderModal } from '@/components/inventory/PurchaseOrderModal';

const LEVEL_ORDER: RuptureLevel[] = ['RUPTURA', 'CRÍTICO', 'ALERTA', 'ATENÇÃO', 'OK'];

function formatNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function OptInEmpty() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <Activity className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="font-semibold">Motor EMA desativado</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            O painel preditivo de ruptura por fornecedor (EMA α=0.3) está disponível mas desligado
            por padrão. Ative a feature flag <code>useEmaRupture</code> para visualizar cobertura em
            dias, lead time efetivo e nível de alerta.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface Props {
  /** Nível pré-selecionado vindo do StockHeroRiskBanner. null = sem filtro. */
  focusedLevel?: string | null;
}

export function RupturePanelEma({ focusedLevel }: Props = {}) {
  // Gate ANTES dos hooks para evitar exigir QueryClientProvider em testes legados.
  if (!isFeatureEnabled('useEmaRupture')) return <OptInEmpty />;
  return <RupturePanelEmaInner focusedLevel={focusedLevel} />;
}

function RupturePanelEmaInner({ focusedLevel }: Props) {
  const { alerts, isLoading, error } = useRuptureAlerts();
  const kpiQuery = useRuptureKpiSummary(false);
  const kpis = kpiQuery.data;
  const kpisLoading = kpiQuery.isLoading;

  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [activeLevels, setActiveLevels] = useState<Set<RuptureLevel>>(() => {
    if (focusedLevel && LEVEL_ORDER.includes(focusedLevel as RuptureLevel)) {
      return new Set([focusedLevel as RuptureLevel]);
    }
    return new Set(['RUPTURA', 'CRÍTICO', 'ALERTA']);
  });

  const [poRow, setPoRow] = useState<RuptureAlertRow | null>(null);

  // Sincronizar com chip do Hero Banner
  useEffect(() => {
    if (focusedLevel && LEVEL_ORDER.includes(focusedLevel as RuptureLevel)) {
      setActiveLevels(new Set([focusedLevel as RuptureLevel]));
    } else if (focusedLevel === null) {
      setActiveLevels(new Set(['RUPTURA', 'CRÍTICO', 'ALERTA']));
    }
    // SEM_SINAL e outros não mapeados: manter seleção atual
  }, [focusedLevel]);

  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of alerts) {
      if (a.supplier_id && a.supplier_name) map.set(a.supplier_id, a.supplier_name);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    );
  }, [alerts]);

  // Etapa 3: sort por prioridade ASC (quebra empate por cobertura_dias ASC)
  const filtered: RuptureAlertRow[] = useMemo(() => {
    return alerts
      .filter((a) => activeLevels.has(a.nivel_alerta))
      .filter((a) => supplierFilter === 'all' || a.supplier_id === supplierFilter)
      .sort((a, b) => {
        const p = (a.prioridade ?? 9999) - (b.prioridade ?? 9999);
        if (p !== 0) return p;
        const ca = a.cobertura_dias ?? Number.POSITIVE_INFINITY;
        const cb = b.cobertura_dias ?? Number.POSITIVE_INFINITY;
        return ca - cb;
      })
      .slice(0, 500);
  }, [alerts, activeLevels, supplierFilter]);

  const kpiByLevel = useMemo(() => {
    const m = new Map<RuptureLevel, number>();
    for (const k of kpis ?? []) m.set(k.nivel_alerta, k.total_variantes);
    return m;
  }, [kpis]);

  function toggleLevel(lvl: RuptureLevel) {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl);
      else next.add(lvl);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Chips de nível — Etapa 3: sort já aplicado abaixo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {LEVEL_ORDER.map((lvl) => {
          const count = kpiByLevel.get(lvl) ?? 0;
          const active = activeLevels.has(lvl);
          return (
            <button
              key={lvl}
              type="button"
              onClick={() => toggleLevel(lvl)}
              className={`flex flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left transition-all hover:shadow-md ${
                active ? 'border-primary/40 ring-1 ring-primary/30' : 'border-border/40'
              }`}
              aria-pressed={active}
            >
              <RuptureLevelBadge level={lvl} />
              <div className="text-2xl font-bold tabular-nums">
                {kpisLoading ? '…' : count.toLocaleString('pt-BR')}
              </div>
              <div className="text-xs text-muted-foreground">variações</div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="h-5 w-5 text-warning" />
                Risco por Fornecedor (EMA)
                <Badge variant="secondary" className="ml-1 text-xs font-normal">
                  {filtered.length} de {alerts.length}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                EMA α=0.3 das vendas diárias × lead time real × fator segurança 1.5. Ordenado por
                prioridade crescente.
              </CardDescription>
            </div>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder="Filtrar fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os fornecedores</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Não foi possível carregar alertas EMA.
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum alerta nos níveis selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Nível</th>
                    <th className="px-2 py-2">Fornecedor</th>
                    <th className="px-2 py-2">SKU</th>
                    <th className="px-2 py-2 text-right">Estoque</th>
                    <th className="px-2 py-2 text-right">EMA/dia</th>
                    <th className="px-2 py-2 text-right">Cobertura</th>
                    <th className="px-2 py-2 text-right">Lead time</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={`${row.variant_id}-${row.supplier_id ?? 'na'}`}
                      className="border-b border-border/30 hover:bg-muted/40"
                    >
                      <td className="px-2 py-2">
                        <RuptureLevelBadge level={row.nivel_alerta} />
                      </td>
                      <td className="px-2 py-2 text-foreground">{row.supplier_name ?? '—'}</td>
                      <td className="px-2 py-2 font-mono text-xs text-muted-foreground">
                        {row.supplier_sku ?? `${row.variant_id.slice(0, 8)}…`}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatNum(row.stock_total, 0)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatNum(row.ema_diaria, 2)}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums">
                        {row.cobertura_dias === null ? '—' : `${formatNum(row.cobertura_dias, 1)}d`}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex cursor-help items-center gap-1 tabular-nums">
                                {formatNum(row.lead_time_efetivo, 0)}d
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Lead time efetivo = lead_time_fornecedor × fator segurança (1.5).
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      {/* Etapa 5: Botão Pedir Reposição */}
                      <td className="px-2 py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => setPoRow(row)}
                          aria-label={`Pedir reposição de ${row.supplier_sku ?? row.variant_id.slice(0, 8)}`}
                        >
                          <ShoppingCart className="h-3 w-3" />
                          Pedir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {alerts.length > filtered.length && filtered.length === 500 && (
                <div className="mt-3 text-center text-xs text-muted-foreground">
                  Exibindo os 500 mais críticos. Refine o filtro para ver mais.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Etapa 5: Modal Pedir Reposição */}
      <PurchaseOrderModal
        open={poRow !== null}
        onOpenChange={(open) => {
          if (!open) setPoRow(null);
        }}
        row={poRow}
      />
    </div>
  );
}

export default RupturePanelEma;
