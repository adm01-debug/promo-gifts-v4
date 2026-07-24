import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type {
  MatchingResult,
  ReplenishmentMatch,
  SupplierReliability,
} from '@/lib/inventory/supplier-reliability';

interface ReplenishmentHistoryTableProps {
  supplier: SupplierReliability;
  matching: MatchingResult;
  pageSize?: number;
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

function delayLabel(d: number): { text: string; cls: string } {
  if (d > 0) return { text: `+${d}d`, cls: 'text-rose-600' };
  if (d < 0) return { text: `${d}d`, cls: 'text-emerald-600' };
  return { text: 'No prazo', cls: 'text-emerald-600' };
}

function fulfillmentLabel(m: ReplenishmentMatch): { text: string; cls: string } {
  const pct = Math.round(m.fulfillmentRatio * 100);
  const cls = pct >= 95 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-rose-600';
  return { text: `${pct}%`, cls };
}

export function ReplenishmentHistoryTable({
  supplier,
  matching,
  pageSize = 20,
}: ReplenishmentHistoryTableProps) {
  const rows = useMemo(() => {
    return matching.matches
      .filter((m) => m.promise.supplierId === supplier.supplierId)
      .sort((a, b) => b.arrival.receivedAt.localeCompare(a.arrival.receivedAt));
  }, [matching, supplier.supplierId]);

  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize);

  if (rows.length === 0) {
    return (
      <div
        data-testid="reliability-history-empty"
        className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground"
      >
        Ainda não há chegadas pareadas com promessas deste fornecedor no histórico
        analisado.
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="reliability-history-table">
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table role="table" className="w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">Prometida</th>
              <th scope="col" className="px-3 py-2 text-left">Recebida</th>
              <th scope="col" className="px-3 py-2 text-right">Atraso</th>
              <th scope="col" className="px-3 py-2 text-right">Prometido</th>
              <th scope="col" className="px-3 py-2 text-right">Recebido</th>
              <th scope="col" className="px-3 py-2 text-right">Cumprimento</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => {
              const delay = delayLabel(m.delayDays);
              const fulfil = fulfillmentLabel(m);
              return (
                <tr
                  key={`${m.promise.id}__${m.arrival.id}`}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <td className="px-3 py-2 tabular-nums">{formatDate(m.promise.promisedDate)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDate(m.arrival.receivedAt)}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums font-medium', delay.cls)}>
                    {delay.text}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {m.promise.promisedQuantity.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {m.arrival.receivedQuantity.toLocaleString('pt-BR')}
                  </td>
                  <td className={cn('px-3 py-2 text-right tabular-nums font-medium', fulfil.cls)}>
                    {fulfil.text}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Página {page + 1} de {pageCount} · {rows.length} registros
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded border border-border px-2 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="rounded border border-border px-2 py-1 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
