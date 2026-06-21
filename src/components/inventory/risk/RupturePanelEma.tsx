/**
 * RupturePanelEma — Painel Risco EMA completo (Onda 2).
 * Novas features:
 * - Score composto (0-100) + confidence badge
 * - Anomalia spike indicator 🔥
 * - Gap unidades (qty a repor)
 * - Sparklines 7d inline
 * - Agrupamento por fornecedor (toggle)
 * - Export CSV dos itens filtrados
 * - Botão "Avisar Fornecedor" (WhatsApp/mailto)
 * - Sort por score_composto DESC dentro do mesmo nível
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertTriangle,
  TrendingDown,
  Activity,
  ShoppingCart,
  Download,
  MessageSquarePlus,
  Flame,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isFeatureEnabled } from '@/lib/feature-flags';
import {
  useRuptureAlerts,
  type RuptureAlertRow,
  type RuptureLevel,
} from '@/hooks/stock/useRuptureAlerts';
import { useRuptureKpiSummary } from '@/hooks/stock/useRuptureKpiSummary';
import { useSupplierRiskBreakdown } from '@/hooks/stock/useSupplierRiskBreakdown';
import { RuptureLevelBadge } from './RuptureLevelBadge';
import { RuptureSparkline } from './RuptureSparkline';
import { PurchaseOrderModal } from '@/components/inventory/PurchaseOrderModal';

const LEVEL_ORDER: RuptureLevel[] = ['RUPTURA', 'CRÍTICO', 'ALERTA', 'ATENÇÃO', 'OK'];

const CONFIDENCE_STYLE = {
  ALTA: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  MÉDIA: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  BAIXA: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  INSUFICIENTE: 'bg-muted/40 text-muted-foreground border-border/40',
} as const;

function fmt(n: number | null | undefined, d = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

function exportCSV(rows: RuptureAlertRow[]) {
  const headers = [
    'Nível',
    'Score',
    'Confiança',
    'Fornecedor',
    'SKU',
    'Estoque',
    'EMA/dia',
    'Cobertura(d)',
    'Gap(un)',
    'Spike',
  ];
  const lines = rows.map((r) =>
    [
      r.nivel_alerta,
      r.score_composto ?? '',
      r.confidence_level ?? '',
      r.supplier_name ?? '',
      r.supplier_sku ?? '',
      r.stock_total ?? 0,
      fmt(r.ema_diaria, 2),
      r.cobertura_dias !== null ? fmt(r.cobertura_dias, 1) : '',
      r.gap_unidades ?? 0,
      r.anomalia_spike ? 'SIM' : 'NÃO',
    ].join(';'),
  );
  const csv = [headers.join(';'), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ema-risco-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildWhatsAppLink(row: RuptureAlertRow): string {
  const msg = encodeURIComponent(
    `Olá! Preciso repor o SKU ${row.supplier_sku ?? row.variant_id.slice(0, 8)} (${row.supplier_name ?? '?'}). ` +
      `Cobertura atual: ${row.cobertura_dias !== null ? `${fmt(row.cobertura_dias, 0)}d` : 'sem estoque'}. ` +
      `EMA: ${fmt(row.ema_diaria, 2)}/dia. Gap: ${(row.gap_unidades ?? 0).toLocaleString('pt-BR')} un. ` +
      `Nível: ${row.nivel_alerta}.`,
  );
  return `https://wa.me/?text=${msg}`;
}

function OptInEmpty() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <Activity className="h-8 w-8 text-muted-foreground" />
        <p className="font-semibold">Motor EMA desativado</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Ative a feature flag <code>useEmaRupture</code> para acessar o painel preditivo.
        </p>
      </CardContent>
    </Card>
  );
}

interface Props {
  focusedLevel?: string | null;
}

export function RupturePanelEma({ focusedLevel }: Props = {}) {
  if (!isFeatureEnabled('useEmaRupture')) return <OptInEmpty />;
  return <RupturePanelEmaInner focusedLevel={focusedLevel} />;
}

function RupturePanelEmaInner({ focusedLevel }: Props) {
  const { alerts, isLoading, error } = useRuptureAlerts();
  const kpiQuery = useRuptureKpiSummary(false);
  const kpis = kpiQuery.data;
  const kpisLoading = kpiQuery.isLoading;
  const { data: supplierData } = useSupplierRiskBreakdown(true);

  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [activeLevels, setActiveLevels] = useState<Set<RuptureLevel>>(() => {
    if (focusedLevel && LEVEL_ORDER.includes(focusedLevel as RuptureLevel))
      return new Set([focusedLevel as RuptureLevel]);
    return new Set(['RUPTURA', 'CRÍTICO', 'ALERTA']);
  });
  const [groupBySupplier, setGroupBySupplier] = useState(false);
  const [poRow, setPoRow] = useState<RuptureAlertRow | null>(null);

  useEffect(() => {
    if (focusedLevel && LEVEL_ORDER.includes(focusedLevel as RuptureLevel)) {
      setActiveLevels(new Set([focusedLevel as RuptureLevel]));
    } else if (focusedLevel === null) {
      setActiveLevels(new Set(['RUPTURA', 'CRÍTICO', 'ALERTA']));
    }
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

  // Sort: score_composto DESC → cobertura_dias ASC (dentro do mesmo nível)
  const filtered: RuptureAlertRow[] = useMemo(() => {
    return alerts
      .filter((a) => activeLevels.has(a.nivel_alerta))
      .filter((a) => supplierFilter === 'all' || a.supplier_id === supplierFilter)
      .sort((a, b) => {
        const p = (a.prioridade ?? 9999) - (b.prioridade ?? 9999);
        if (p !== 0) return p;
        // Dentro do mesmo nível: maior score primeiro
        return (b.score_composto ?? 0) - (a.score_composto ?? 0);
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

  // Vista agrupada por fornecedor
  const supplierGroups = useMemo(() => {
    if (!groupBySupplier) return null;
    const map = new Map<string, { name: string; rows: RuptureAlertRow[] }>();
    for (const row of filtered) {
      const key = row.supplier_id ?? '__sem_fornecedor__';
      if (!map.has(key)) map.set(key, { name: row.supplier_name ?? 'Sem fornecedor', rows: [] });
      map.get(key)!.rows.push(row);
    }
    return Array.from(map.values()).sort((a, b) => b.rows.length - a.rows.length);
  }, [filtered, groupBySupplier]);

  return (
    <div className="space-y-4">
      {/* Chips de nível */}
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
                EMA α=0.3 × lead time × fator 1.5. Score composto 0-100. Sort: score DESC.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Toggle agrupamento por fornecedor */}
              <Button
                variant={groupBySupplier ? 'default' : 'outline'}
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setGroupBySupplier((v) => !v)}
              >
                <Layers className="h-3.5 w-3.5" />
                Por fornecedor
              </Button>

              {/* Export CSV */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => exportCSV(filtered)}
                disabled={filtered.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                CSV ({filtered.length})
              </Button>

              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="Fornecedor" />
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
              <AlertTriangle className="h-4 w-4" /> Não foi possível carregar alertas EMA.
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum alerta nos níveis selecionados.
            </div>
          ) : groupBySupplier && supplierGroups ? (
            // Vista agrupada por fornecedor
            <div className="space-y-4">
              {supplierGroups.map((grp) => (
                <div key={grp.name}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-sm font-semibold">{grp.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {grp.rows.length}
                    </Badge>
                    {supplierData?.find((s) => s.supplier_name === grp.name) && (
                      <span className="text-xs text-muted-foreground">
                        {supplierData.find((s) => s.supplier_name === grp.name)?.pct_risco}% crítico
                      </span>
                    )}
                  </div>
                  <RuptureTable rows={grp.rows} onPedir={setPoRow} />
                </div>
              ))}
            </div>
          ) : (
            <RuptureTable rows={filtered} onPedir={setPoRow} />
          )}
        </CardContent>
      </Card>

      <PurchaseOrderModal
        open={poRow !== null}
        onOpenChange={(o) => {
          if (!o) setPoRow(null);
        }}
        row={poRow}
      />
    </div>
  );
}

// Sub-componente da tabela (reusado nas vistas flat e agrupada)
function RuptureTable({
  rows,
  onPedir,
}: {
  rows: RuptureAlertRow[];
  onPedir: (row: RuptureAlertRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5">Nível</th>
            <th className="px-2 py-1.5">Score</th>
            <th className="px-2 py-1.5">Fornecedor</th>
            <th className="px-2 py-1.5">SKU</th>
            <th className="px-2 py-1.5 text-right">Estoque</th>
            <th className="px-2 py-1.5 text-right">EMA/d</th>
            <th className="px-2 py-1.5 text-right">Cob.</th>
            <th className="px-2 py-1.5 text-right">Gap</th>
            <th className="px-2 py-1.5 text-center">7d</th>
            <th className="px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.variant_id}-${row.supplier_id ?? 'na'}`}
              className={cn(
                'border-b border-border/30 hover:bg-muted/40',
                row.anomalia_spike && 'bg-amber-500/5',
              )}
            >
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <RuptureLevelBadge level={row.nivel_alerta} />
                  {row.anomalia_spike && (
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger>
                          <Flame
                            className="h-3.5 w-3.5 text-amber-500"
                            aria-label="Pico de depleção"
                          />
                        </TooltipTrigger>
                        <TooltipContent>Pico de depleção detectado (7d)</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </td>
              <td className="px-2 py-1.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold tabular-nums">
                    {row.score_composto ?? '—'}
                  </span>
                  {row.confidence_level && (
                    <span
                      className={cn(
                        'rounded border px-1 py-0 text-[10px] font-medium leading-tight',
                        CONFIDENCE_STYLE[row.confidence_level],
                      )}
                    >
                      {row.confidence_level}
                    </span>
                  )}
                </div>
              </td>
              <td className="max-w-[120px] truncate px-2 py-1.5 text-foreground">
                {row.supplier_name ?? '—'}
              </td>
              <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                {row.supplier_sku ?? `${row.variant_id.slice(0, 8)}…`}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(row.stock_total, 0)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(row.ema_diaria, 2)}</td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                {row.cobertura_dias === null ? '—' : `${fmt(row.cobertura_dias, 1)}d`}
              </td>
              <td className="px-2 py-1.5 text-right text-xs tabular-nums">
                {row.gap_unidades ? row.gap_unidades.toLocaleString('pt-BR') : '—'}
              </td>
              <td className="px-2 py-1.5 text-center">
                <RuptureSparkline variantId={row.variant_id} days={7} width={48} height={20} />
              </td>
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 gap-1 px-1.5 text-[10px]"
                          onClick={() => onPedir(row)}
                        >
                          <ShoppingCart className="h-3 w-3" /> Pedir
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Criar pedido de reposição</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a href={buildWhatsAppLink(row)} target="_blank" rel="noopener noreferrer">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 gap-1 px-1.5 text-[10px] text-emerald-600"
                            asChild
                          >
                            <span>
                              <MessageSquarePlus className="h-3 w-3" /> WA
                            </span>
                          </Button>
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>Avisar fornecedor via WhatsApp</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 500 && (
        <div className="mt-3 text-center text-xs text-muted-foreground">
          Exibindo os 500 mais críticos. Refine o filtro para ver mais.
        </div>
      )}
    </div>
  );
}

export default RupturePanelEma;
