/**
 * QuotesStatusChips — chips horizontais com contador por status.
 * Sticky abaixo do header, scroll horizontal em mobile.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { QUOTE_STATUS_CONFIG } from '@/lib/quote-status-config';
import type { Quote } from '@/hooks/quotes';

interface QuotesStatusChipsProps {
  quotes: Quote[];
  value: string;
  onChange: (status: string) => void;
}

const ORDER = ['all', 'draft', 'pending', 'sent', 'approved', 'rejected', 'expired'] as const;

export function QuotesStatusChips({ quotes, value, onChange }: QuotesStatusChipsProps) {
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: quotes.length };
    for (const q of quotes) {
      map[q.status] = (map[q.status] ?? 0) + 1;
    }
    return map;
  }, [quotes]);

  return (
    <div className="sticky top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px))] z-20 -mx-1 border-b border-border/40 bg-background/85 px-1 py-2 backdrop-blur-md">
      <div className="scrollbar-thin flex items-center gap-1.5 overflow-x-auto">
        {ORDER.map((key) => {
          const isActive = value === key;
          const label = key === 'all' ? 'Todos' : (QUOTE_STATUS_CONFIG[key]?.label ?? key);
          const count = counts[key] || 0;
          if (key !== 'all' && count === 0 && !isActive) return null;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all',
                'whitespace-nowrap border',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
              aria-pressed={isActive}
            >
              <span>{label}</span>
              <span
                className={cn(
                  'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums',
                  isActive
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-foreground/70',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
