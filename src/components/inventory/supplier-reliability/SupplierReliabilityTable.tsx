import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUpDown, Search, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ReliabilityBadge } from './ReliabilityBadge';
import type { SupplierReliability } from '@/lib/inventory/supplier-reliability';

interface SupplierReliabilityTableProps {
  suppliers: readonly SupplierReliability[];
  onSelect: (supplierId: string) => void;
  selectedId?: string | null;
}

type SortKey = 'score' | 'name' | 'matches' | 'delay' | 'next';

function formatPct(v: number | null): string {
  if (v === null) return '—';
  return `${Math.round(v * 100)}%`;
}

function formatDelay(v: number | null): string {
  if (v === null) return '—';
  return `${v.toFixed(1)}d`;
}

function formatNext(p: SupplierReliability['nextPromise']): string {
  if (!p) return '—';
  try {
    return format(parseISO(p.promisedDate), "dd MMM", { locale: ptBR });
  } catch {
    return p.promisedDate;
  }
}

export function SupplierReliabilityTable({
  suppliers,
  onSelect,
  selectedId,
}: SupplierReliabilityTableProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? suppliers.filter((s) => s.supplierName.toLowerCase().includes(q))
      : [...suppliers];
    const dir = sortDir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.supplierName.localeCompare(b.supplierName, 'pt-BR');
          break;
        case 'matches':
          cmp = a.matchedCount - b.matchedCount;
          break;
        case 'delay':
          cmp = (a.overall.avgDelayDays ?? 0) - (b.overall.avgDelayDays ?? 0);
          break;
        case 'next': {
          const an = a.nextPromise?.promisedDate ?? '9999';
          const bn = b.nextPromise?.promisedDate ?? '9999';
          cmp = an.localeCompare(bn);
          break;
        }
        case 'score':
        default:
          cmp = (a.overall.score ?? -1) - (b.overall.score ?? -1);
      }
      return cmp * dir;
    });
    return filtered;
  }, [suppliers, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'next' ? 'asc' : 'desc');
    }
  }

  const Header = ({ k, label, align = 'left' }: { k: SortKey; label: string; align?: 'left' | 'right' }) => (
    <th
      scope="col"
      className={cn(
        'sticky top-0 z-10 bg-card px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground',
        align === 'right' && 'text-right',
      )}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => toggleSort(k)}
        aria-sort={sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {label}
        <ArrowUpDown
          className={cn('h-3 w-3 opacity-50', sortKey === k && 'opacity-100 text-primary')}
        />
      </button>
    </th>
  );

  return (
    <div className="space-y-3" data-testid="supplier-reliability-table">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="reliability-search"
            placeholder="Buscar fornecedor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {rows.length} de {suppliers.length} fornecedores
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table role="table" className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <Header k="name" label="Fornecedor" />
              <Header k="score" label="Confiança" align="right" />
              <Header k="matches" label="Pareadas" align="right" />
              <Header k="delay" label="Atraso médio" align="right" />
              <Header k="next" label="Próxima reposição" />
              <th className="sticky top-0 z-10 w-8 bg-card" aria-label="ações" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-sm text-muted-foreground">
                  Nenhum fornecedor encontrado.
                </td>
              </tr>
            )}
            {rows.map((s) => {
              const isSelected = s.supplierId === selectedId;
              return (
                <tr
                  key={s.supplierId}
                  role="button"
                  tabIndex={0}
                  data-testid={`reliability-row-${s.supplierId}`}
                  onClick={() => onSelect(s.supplierId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(s.supplierId);
                    }
                  }}
                  className={cn(
                    'cursor-pointer border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none',
                    isSelected && 'bg-primary/5',
                  )}
                >
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground">{s.supplierName}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.totalPromises} promessas · {s.totalArrivals} chegadas
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <ReliabilityBadge band={s.band} score={s.overall.score} size="sm" />
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      P {formatPct(s.overall.pontualityScore)} · Q{' '}
                      {formatPct(s.overall.fulfillmentScore)}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.matchedCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatDelay(s.overall.avgDelayDays)}
                  </td>
                  <td className="px-3 py-2.5">
                    {s.nextPromise ? (
                      <div>
                        <div className="text-sm">{formatNext(s.nextPromise)}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {s.nextPromise.promisedQuantity.toLocaleString('pt-BR')} un.
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
