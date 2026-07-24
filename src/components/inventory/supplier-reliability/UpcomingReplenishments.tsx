import { useMemo } from 'react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock } from 'lucide-react';
import type {
  MatchingResult,
  SupplierReliability,
} from '@/lib/inventory/supplier-reliability';

interface UpcomingReplenishmentsProps {
  supplier: SupplierReliability;
  matching: MatchingResult;
}

export function UpcomingReplenishments({ supplier, matching }: UpcomingReplenishmentsProps) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(() => {
    return matching.unmatchedPromises
      .filter(
        (u) => u.promise.supplierId === supplier.supplierId && u.promise.promisedDate >= today,
      )
      .sort((a, b) => a.promise.promisedDate.localeCompare(b.promise.promisedDate))
      .slice(0, 12);
  }, [matching, supplier.supplierId, today]);

  if (upcoming.length === 0) {
    return (
      <div
        data-testid="reliability-upcoming-empty"
        className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground"
      >
        Sem reposições futuras prometidas por este fornecedor.
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="reliability-upcoming-list"
    >
      {upcoming.map(({ promise }) => {
        let dateLabel = promise.promisedDate;
        let inDays = 0;
        try {
          const d = parseISO(promise.promisedDate);
          dateLabel = format(d, "dd 'de' MMM", { locale: ptBR });
          inDays = differenceInCalendarDays(d, new Date());
        } catch {
          /* ignore */
        }
        return (
          <div
            key={promise.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <CalendarClock className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{dateLabel}</div>
              <div className="text-xs text-muted-foreground">
                {inDays === 0 ? 'hoje' : inDays === 1 ? 'amanhã' : `em ${inDays} dias`} · slot{' '}
                {promise.slot}
              </div>
              <div className="mt-1 text-sm tabular-nums">
                {promise.promisedQuantity.toLocaleString('pt-BR')} unidades
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
