import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  Bot,
  Info,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LatencyBadge } from './LatencyBadge';
import { ConnectionTimelineDrawer } from './ConnectionTimelineDrawer';
import { ConnectionTestDetailsDialog } from './ConnectionTestDetailsDialog';
import {
  useConnectionTestHistory,
  type ConnectionType,
  type TestHistoryItem,
} from '@/hooks/intelligence';
import { getErrorCopy, getKindBadgeClass, getKindLabel } from '@/lib/connection-error-copy';
import { inferErrorKind } from '@/lib/error-kind-inference';

interface Props {
  type: ConnectionType;
  envKey?: 'promobrind' | 'crm';
  connectionId?: string;
  /** Bump after a "Testar conexão" succeeds to refetch. */
  refreshKey?: number | string;
  /** Label used inside the timeline drawer ("Ver tudo →") and detail dialog. */
  label: string;
  className?: string;
  /** Show the 5 latest tests inline by default (default: true). */
  defaultPreview?: boolean;
  /** When set, renders a non-clickable placeholder row at the top of the list
   *  ("Teste em andamento…") so the user sees the test was queued before the
   *  real history row arrives via refreshKey. Cleared by the parent on result. */
  pendingTest?: { startedAt: string } | null;
}

const PREVIEW_SIZE_OPTIONS = [5, 10, 20] as const;
type PreviewSize = (typeof PREVIEW_SIZE_OPTIONS)[number];
const PREVIEW_SIZE_STORAGE_KEY = 'connections.history_preview_size';
const DEFAULT_PREVIEW_SIZE: PreviewSize = 5;

function loadPreviewSize(): PreviewSize {
  if (typeof window === 'undefined') return DEFAULT_PREVIEW_SIZE;
  try {
    const raw = window.localStorage.getItem(PREVIEW_SIZE_STORAGE_KEY);
    const parsed = parseInt(raw ?? '', 10);
    if (PREVIEW_SIZE_OPTIONS.includes(parsed as PreviewSize)) return parsed as PreviewSize;
  } catch {
    /* ignore */
  }
  return DEFAULT_PREVIEW_SIZE;
}

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 5_000) return 'agora há pouco';
  if (diff < 60_000) return `há ${Math.round(diff / 1000)}s`;
  if (diff < 3_600_000) return `há ${Math.round(diff / 60_000)}min`;
  if (diff < 86_400_000) return `há ${Math.round(diff / 3_600_000)}h`;
  return `há ${Math.round(diff / 86_400_000)}d`;
}

function formatAbsolute(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

type StatusFilter = 'all' | 'ok' | 'fail';
type SourceFilter = 'all' | 'manual' | 'cron';

function emptyMessage(status: StatusFilter, source: SourceFilter): string {
  if (source === 'cron' && status === 'fail') return 'Nenhuma falha do cron neste período 🎉';
  if (source === 'cron') return 'Nenhum teste automático neste período.';
  if (source === 'manual') return 'Nenhum teste manual neste período.';
  if (status === 'fail') return 'Nenhuma falha nos últimos testes 🎉';
  return 'Nenhum teste com este filtro.';
}

interface SourceFilterChipsProps {
  value: SourceFilter;
  onChange: (v: SourceFilter) => void;
  allCount: number;
  manualCount: number;
  cronOk: number;
  cronFail: number;
  cronTotal: number;
}

function SourceFilterChips({
  value,
  onChange,
  allCount,
  manualCount,
  cronOk,
  cronFail,
  cronTotal,
}: SourceFilterChipsProps) {
  const options: Array<{ key: SourceFilter; label: string; count: number }> = [
    { key: 'all', label: 'Todas as origens', count: allCount },
    { key: 'manual', label: 'Manuais', count: manualCount },
    { key: 'cron', label: 'Cron', count: cronTotal },
  ];
  return (
    <div
      className="flex flex-wrap items-center gap-1 px-1"
      role="group"
      aria-label="Filtrar por origem do teste"
    >
      <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        Origem:
      </span>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(opt.key);
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] tabular-nums transition-colors',
              active
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-transparent text-muted-foreground hover:bg-muted/60',
            )}
            aria-pressed={active}
          >
            {opt.key === 'cron' && <Bot className="h-3 w-3" aria-hidden />}
            <span>
              {opt.label} ({opt.count})
            </span>
            {opt.key === 'cron' && cronTotal > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px]">
                <span className="tabular-nums text-green-700 dark:text-green-400">✓{cronOk}</span>
                <span className="tabular-nums text-destructive">✗{cronFail}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Mini sparkline SVG (sem libs) das latências (oldest → newest, esquerda → direita). */
function LatencySparkline({
  items,
  width = 64,
  height = 18,
}: {
  items: TestHistoryItem[];
  width?: number;
  height?: number;
}) {
  // Ordena cronologicamente asc (mais antigo à esquerda) e pega até 12 pontos
  const sorted = [...items]
    .filter((i) => i.latency_ms !== null)
    .sort((a, b) => new Date(a.tested_at).getTime() - new Date(b.tested_at).getTime())
    .slice(-12);
  if (sorted.length < 2) return null;

  const values = sorted.map((i) => i.latency_ms!);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const stepX = width / (sorted.length - 1);
  const pad = 2;
  const innerH = height - pad * 2;

  const points = sorted.map((it, idx) => {
    const x = idx * stepX;
    const y = pad + innerH - ((it.latency_ms! - min) / range) * innerH;
    return { x, y, ok: it.ok };
  });
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const last = points[points.length - 1];
  const allOk = points.every((p) => p.ok);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="shrink-0 overflow-visible"
          aria-label={`Sparkline de latência: ${min}–${max}ms`}
          role="img"
        >
          <path
            d={path}
            fill="none"
            strokeWidth={1.25}
            className={cn(
              allOk ? 'stroke-green-500/80 dark:stroke-green-400/80' : 'stroke-destructive/80',
            )}
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === points.length - 1 ? 1.6 : 0.9}
              className={cn(p.ok ? 'fill-green-600 dark:fill-green-400' : 'fill-destructive')}
            />
          ))}
          <circle
            cx={last.x}
            cy={last.y}
            r={2.4}
            className="fill-transparent stroke-foreground/40"
            strokeWidth={0.6}
          />
        </svg>
      </TooltipTrigger>
      <TooltipContent side="top">
        Latência (últimos {sorted.length}): min {min}ms · máx {max}ms
      </TooltipContent>
    </Tooltip>
  );
}

interface RowProps {
  item: TestHistoryItem;
  onClick: () => void;
  highlighted?: boolean;
  rowRef?: (el: HTMLDivElement | null) => void;
}

/**
 * Optimistic placeholder shown at the top of the list while a manual test is
 * in flight, so users see immediately that their click was registered and a new
 * row will be appended without a page reload.
 */
function PendingHistoryRow({ startedAt }: { startedAt: string }) {
  const rel = formatRelative(startedAt);
  return (
    <li>
      <div
        className={cn(
          'grid w-full grid-cols-[14px_minmax(80px,auto)_minmax(54px,auto)_1fr_auto] items-center gap-2 rounded px-1.5 py-1 text-xs',
          'animate-pulse border border-dashed border-primary/40 bg-primary/5 text-primary',
        )}
        aria-live="polite"
        aria-label="Teste em andamento"
      >
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span className="truncate tabular-nums text-muted-foreground">
          iniciado {rel || 'agora'}
        </span>
        <span className="text-[10px] text-muted-foreground/70">…ms</span>
        <span className="truncate text-primary/80">Aguardando resposta do servidor…</span>
        <span className="shrink-0 px-1 text-[10px] text-primary/70">novo</span>
      </div>
    </li>
  );
}

function HistoryRow({ item: it, onClick, highlighted, rowRef }: RowProps) {
  const Icon = it.ok ? CheckCircle2 : XCircle;
  const tail = it.ok
    ? `HTTP ${it.status ?? '?'}${it.message ? ` — ${it.message}` : ''}`
    : it.message || 'Falha';
  // Para falhas, infere kind (com fallback heurístico para registros antigos)
  // e renderiza badge semântico ao lado da mensagem.
  const resolvedKind = !it.ok
    ? inferErrorKind({
        errorKind: it.error_kind ?? null,
        errorMessage: it.message ?? null,
        statusCode: it.status ?? null,
        success: it.ok,
      })
    : null;
  const kindCopy = resolvedKind ? getErrorCopy(resolvedKind, it.status, it.message) : null;
  return (
    <li>
      <div
        ref={rowRef}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(
          'grid w-full cursor-pointer scroll-mt-4 grid-cols-[14px_minmax(80px,auto)_minmax(54px,auto)_1fr_auto] items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-all',
          'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          !it.ok && 'bg-destructive/[0.03] hover:bg-destructive/10',
          highlighted && 'animate-pulse-once bg-destructive/15 ring-2 ring-destructive/70',
        )}
        aria-label={it.ok ? 'Ver detalhes deste teste' : 'Ver detalhes do erro'}
      >
        <Icon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            it.ok ? 'text-green-700 dark:text-green-400' : 'text-destructive',
          )}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 truncate tabular-nums text-muted-foreground">
              {formatRelative(it.tested_at)}
              {it.triggered_by === 'cron' && (
                <Bot className="h-3 w-3 text-muted-foreground/70" aria-label="Teste automático" />
              )}
              {(it.attempts ?? 1) > 1 && (
                <span
                  className={cn(
                    'rounded border px-1 py-0.5 text-[9px] font-semibold tabular-nums leading-none',
                    it.ok
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : 'border-destructive/30 bg-destructive/10 text-destructive',
                  )}
                  aria-label={`${it.attempts} tentativas`}
                >
                  {it.attempts}×
                </span>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            {formatAbsolute(it.tested_at)}
            {it.triggered_by === 'cron' && ' · automático (cron)'}
            {it.triggered_by === 'manual' && ' · manual'}
            {(it.attempts ?? 1) > 1 && (
              <>
                {' '}
                · {it.attempts} tentativas{it.ok ? ' (recuperou na 2ª)' : ''}
              </>
            )}
          </TooltipContent>
        </Tooltip>
        <LatencyBadge ms={it.latency_ms} />
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'inline-flex min-w-0 items-center gap-1.5 truncate',
                it.ok ? 'text-foreground/80' : 'text-destructive',
              )}
            >
              {kindCopy && (
                <span
                  className={cn(
                    'inline-flex h-4 shrink-0 items-center gap-1 rounded border px-1 text-[9px] font-medium tabular-nums',
                    getKindBadgeClass(kindCopy.tone),
                  )}
                  title={`Tipo de falha: ${kindCopy.title}`}
                  aria-label={`Tipo de falha: ${getKindLabel(kindCopy.tone)}`}
                >
                  {getKindLabel(kindCopy.tone)}
                </span>
              )}
              <span className="truncate">{tail}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="break-words">
            {kindCopy ? `${kindCopy.title} — ${tail}` : tail}
          </TooltipContent>
        </Tooltip>
        {!it.ok ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive hover:underline"
            aria-hidden
          >
            <Info className="h-3 w-3" />
            Ver detalhes do erro
          </span>
        ) : (
          <span className="shrink-0 px-1 text-[10px] text-muted-foreground/60" aria-hidden>
            Ver →
          </span>
        )}
      </div>
    </li>
  );
}

export function ConnectionTestHistoryPanel({
  type,
  envKey,
  connectionId,
  refreshKey,
  label,
  className,
  defaultPreview = true,
  pendingTest = null,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [previewSize, setPreviewSize] = useState<PreviewSize>(() => loadPreviewSize());

  const updatePreviewSize = (n: PreviewSize) => {
    setPreviewSize(n);
    try {
      window.localStorage.setItem(PREVIEW_SIZE_STORAGE_KEY, String(n));
    } catch {
      /* ignore */
    }
  };

  // Limit fetched rows to cover the largest preview size + headroom for filtering
  const fetchLimit = expanded ? Math.max(20, previewSize * 2) : Math.max(10, previewSize + 5);

  const { items, total, loading } = useConnectionTestHistory({
    type,
    envKey,
    connectionId,
    refreshKey,
    enabled: expanded,
    limit: fetchLimit,
  });

  // Source-filtered base list — status counts and visible items both derive from here
  const sourceFiltered = useMemo(() => {
    if (source === 'manual') return items.filter((i) => i.triggered_by !== 'cron');
    if (source === 'cron') return items.filter((i) => i.triggered_by === 'cron');
    return items;
  }, [items, source]);

  const counts = useMemo(
    () => ({
      all: sourceFiltered.length,
      ok: sourceFiltered.filter((i) => i.ok).length,
      fail: sourceFiltered.filter((i) => !i.ok).length,
    }),
    [sourceFiltered],
  );

  // Cron-only counts (always over the whole `items`) — used for the source chip badges
  const cronCounts = useMemo(() => {
    const cron = items.filter((i) => i.triggered_by === 'cron');
    return {
      total: cron.length,
      ok: cron.filter((i) => i.ok).length,
      fail: cron.filter((i) => !i.ok).length,
    };
  }, [items]);
  const manualTotal = items.length - cronCounts.total;

  const visibleItems = useMemo(() => {
    if (filter === 'ok') return sourceFiltered.filter((i) => i.ok);
    if (filter === 'fail') return sourceFiltered.filter((i) => !i.ok);
    return sourceFiltered;
  }, [sourceFiltered, filter]);

  const previewItems = useMemo(
    () => visibleItems.slice(0, previewSize),
    [visibleItems, previewSize],
  );

  const stats = useMemo(() => {
    if (items.length === 0) return null;
    const latencies = items.flatMap((i) => (i.ok && i.latency_ms !== null ? [i.latency_ms] : []));
    const avg = latencies.length
      ? Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length)
      : null;
    return {
      rate: Math.round((counts.ok / items.length) * 100),
      avg,
      ok: counts.ok,
      total: items.length,
    };
  }, [items, counts.ok]);

  const empty = total === 0 && !loading;
  // Show the inline preview whenever defaultPreview is on AND we either have
  // data, are loading, or have an in-flight test to surface.
  const showPreview = defaultPreview && !expanded && (!empty || !!pendingTest);

  // Most-recent failure (items are returned newest-first)
  const latestFailure = useMemo(() => items.find((i) => !i.ok) ?? null, [items]);

  // Highlight + scroll-to logic for "Ver erro mais recente"
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(t);
  }, [highlightId]);

  // Auto-highlight the freshest item whenever refreshKey changes (i.e. a manual
  // test just completed). Items are returned newest-first by the edge function.
  const prevRefreshKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (prevRefreshKeyRef.current === refreshKey) return;
    prevRefreshKeyRef.current = refreshKey;
    if (items.length > 0) setHighlightId(items[0].id);
  }, [refreshKey, items]);

  const goToLatestFailure = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!latestFailure) return;
    if (!expanded && !showPreview) setExpanded(true);
    if (filter === 'ok') setFilter('all');
    setHighlightId(latestFailure.id);
    // wait for next paint so the row exists in DOM
    requestAnimationFrame(() => {
      const el = rowRefs.current.get(latestFailure.id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus?.();
    });
  };

  const setRowRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  };

  return (
    <div className={cn('mt-3 border-t pt-3', className)}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => !empty && setExpanded((v) => !v)}
          disabled={empty}
          className={cn(
            'flex flex-1 items-center justify-between gap-2 text-xs font-medium',
            'rounded-md px-1 py-1 transition-colors',
            empty
              ? 'cursor-not-allowed text-muted-foreground/60'
              : 'text-foreground hover:bg-muted/50',
          )}
          aria-expanded={expanded}
        >
          <span className="inline-flex items-center gap-1.5">
            {empty ? (
              <History className="h-3.5 w-3.5" />
            ) : defaultPreview ? (
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
              />
            ) : (
              <ChevronRight
                className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')}
              />
            )}
            {showPreview ? `Últimas verificações (${total})` : `Histórico de testes (${total})`}
          </span>
          <span className="inline-flex items-center gap-2">
            {!expanded && items.length >= 2 && (
              <TooltipProvider>
                <LatencySparkline items={items} />
              </TooltipProvider>
            )}
            {stats && !expanded && (
              <span
                className={cn(
                  'text-[11px] tabular-nums',
                  stats.rate === 100
                    ? 'text-green-700 dark:text-green-400'
                    : stats.rate >= 80
                      ? 'text-muted-foreground'
                      : 'text-destructive',
                )}
              >
                {stats.rate}% sucesso
              </span>
            )}
          </span>
        </button>
        {latestFailure && (
          <button
            type="button"
            onClick={goToLatestFailure}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 text-[10px] font-medium',
              'rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive',
              'transition-colors hover:bg-destructive/20',
            )}
            aria-label="Rolar até o erro mais recente e destacar"
            title="Rolar até o erro mais recente"
          >
            <AlertCircle className="h-3 w-3" />
            Ver erro mais recente
          </button>
        )}
      </div>

      {/* Preview inline (5 itens, com filtros rápidos) */}
      {showPreview && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  { key: 'all', label: 'Todos', count: counts.all },
                  { key: 'ok', label: 'OK', count: counts.ok },
                  { key: 'fail', label: 'Falhas', count: counts.fail },
                ] as const
              ).map((opt) => {
                const active = filter === opt.key;
                const isFail = opt.key === 'fail';
                const isOk = opt.key === 'ok';
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilter(opt.key);
                    }}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] tabular-nums transition-colors',
                      active
                        ? isFail
                          ? 'border-destructive/40 bg-destructive/10 text-destructive'
                          : isOk
                            ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400'
                            : 'border-border bg-muted text-foreground'
                        : 'border-transparent text-muted-foreground hover:bg-muted/60',
                    )}
                    aria-pressed={active}
                    aria-label={`Mostrar ${opt.label.toLowerCase()}`}
                  >
                    {opt.label} ({opt.count})
                  </button>
                );
              })}
            </div>
            <div
              className="flex items-center gap-0.5 text-[10px] text-muted-foreground"
              role="group"
              aria-label="Itens visíveis no preview"
            >
              <span className="mr-1 uppercase tracking-wider">Mostrar:</span>
              {PREVIEW_SIZE_OPTIONS.map((n) => {
                const active = previewSize === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updatePreviewSize(n);
                    }}
                    className={cn(
                      'rounded border px-1.5 py-0.5 tabular-nums transition-colors',
                      active
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-transparent hover:bg-muted/60',
                    )}
                    aria-pressed={active}
                    aria-label={`Mostrar ${n} itens`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
          <SourceFilterChips
            value={source}
            onChange={setSource}
            allCount={items.length}
            manualCount={manualTotal}
            cronOk={cronCounts.ok}
            cronFail={cronCounts.fail}
            cronTotal={cronCounts.total}
          />
        </div>
      )}
      {showPreview && (
        <div className="mt-2 space-y-2">
          {loading && previewItems.length === 0 && !pendingTest ? (
            <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Carregando…
            </div>
          ) : previewItems.length === 0 && !pendingTest ? (
            <div className="py-3 text-center text-xs text-muted-foreground">
              {emptyMessage(filter, source)}
            </div>
          ) : (
            <TooltipProvider>
              <ul className="space-y-0.5">
                {pendingTest && <PendingHistoryRow startedAt={pendingTest.startedAt} />}
                {previewItems.map((it) => (
                  <HistoryRow
                    key={it.id}
                    item={it}
                    onClick={() => setDetailsId(it.id)}
                    highlighted={highlightId === it.id}
                    rowRef={setRowRef(it.id)}
                  />
                ))}
              </ul>
            </TooltipProvider>
          )}
        </div>
      )}

      {/* Expandido: filtros + lista + stats + drawer */}
      {expanded && !empty && (
        <div className="mt-2 space-y-2 duration-200 animate-in fade-in-50">
          <div className="flex items-center gap-1 px-1">
            {(
              [
                { key: 'all', label: 'Todos', count: counts.all },
                { key: 'ok', label: 'OK', count: counts.ok },
                { key: 'fail', label: 'Falhas', count: counts.fail },
              ] as const
            ).map((opt) => {
              const active = filter === opt.key;
              const isFail = opt.key === 'fail';
              const isOk = opt.key === 'ok';
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFilter(opt.key)}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] tabular-nums transition-colors',
                    active
                      ? isFail
                        ? 'border-destructive/40 bg-destructive/10 text-destructive'
                        : isOk
                          ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400'
                          : 'border-border bg-muted text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-muted/60',
                  )}
                  aria-pressed={active}
                >
                  {opt.label} ({opt.count})
                </button>
              );
            })}
          </div>
          <SourceFilterChips
            value={source}
            onChange={setSource}
            allCount={items.length}
            manualCount={manualTotal}
            cronOk={cronCounts.ok}
            cronFail={cronCounts.fail}
            cronTotal={cronCounts.total}
          />

          {loading && items.length === 0 && !pendingTest ? (
            <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Carregando…
            </div>
          ) : visibleItems.length === 0 && !pendingTest ? (
            <div className="py-3 text-center text-xs text-muted-foreground">
              {emptyMessage(filter, source)}
            </div>
          ) : (
            <TooltipProvider>
              <ul className="space-y-0.5">
                {pendingTest && <PendingHistoryRow startedAt={pendingTest.startedAt} />}
                {visibleItems.map((it) => (
                  <HistoryRow
                    key={it.id}
                    item={it}
                    onClick={() => setDetailsId(it.id)}
                    highlighted={highlightId === it.id}
                    rowRef={setRowRef(it.id)}
                  />
                ))}
              </ul>
            </TooltipProvider>
          )}

          {stats && (
            <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
              <span>
                Taxa de sucesso:{' '}
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    stats.rate === 100
                      ? 'text-green-700 dark:text-green-400'
                      : stats.rate >= 80
                        ? 'text-foreground'
                        : 'text-destructive',
                  )}
                >
                  {stats.rate}%
                </span>
                {stats.avg !== null && (
                  <>
                    {' '}
                    · Latência média:{' '}
                    <span className="font-medium tabular-nums text-foreground">{stats.avg}ms</span>
                  </>
                )}
              </span>
              <ConnectionTimelineDrawer
                type={type}
                label={label}
                triggerVariant="ghost"
                open={timelineOpen}
                onOpenChange={setTimelineOpen}
              />
            </div>
          )}
        </div>
      )}

      <ConnectionTestDetailsDialog
        open={detailsId !== null}
        onOpenChange={(v) => {
          if (!v) setDetailsId(null);
        }}
        connectionType={type}
        connectionLabel={label}
        envKey={envKey}
        connectionId={connectionId}
        historyId={detailsId ?? undefined}
        onViewFullHistory={() => setTimelineOpen(true)}
      />
    </div>
  );
}
