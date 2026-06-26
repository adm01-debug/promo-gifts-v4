/**
 * QuotesStatusChips — chips horizontais com contador por status / flag de sync.
 * Sticky abaixo do header, scroll horizontal em mobile.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Quote } from '@/hooks/quotes';

interface QuotesStatusChipsProps {
  quotes: Quote[];
  value: string;
  onChange: (status: string) => void;
}

type ChipDef = {
  key: string;
  label: string;
  match: (q: Quote) => boolean;
};

const CHIPS: ChipDef[] = [
  { key: 'all', label: 'Todos', match: () => true },
  { key: 'draft', label: 'Rascunho', match: (q) => q.status === 'draft' },
  {
    key: 'unsynced',
    label: 'Criado (Não Sinc.)',
    match: (q) => q.status === 'pending' && !q.synced_to_bitrix,
  },
  { key: 'synced', label: 'Sincronizado', match: (q) => q.synced_to_bitrix === true },
  { key: 'pending', label: 'Pendente', match: (q) => q.status === 'pending' },
  { key: 'expired', label: 'Expirado', match: (q) => q.status === 'expired' },
];

export function QuotesStatusChips({ quotes, value, onChange }: QuotesStatusChipsProps) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const chip of CHIPS) {
      map[chip.key] = quotes.filter(chip.match).length;
    }
    return map;
  }, [quotes]);

  return (
    <div className="sticky top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px))] z-20 -mx-1 border-b border-border/40 bg-background/85 px-1 py-2 backdrop-blur-md">
      <div className="scrollbar-thin flex items-center gap-1.5 overflow-x-auto">
        {CHIPS.map(({ key, label }) => {
          const isActive = value === key;
          const count = counts[key] || 0;
          if (key !== 'all' && count === 0 && !isActive) return null;
          const isSynced = key === 'synced';

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
                  : cn(
                      'bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      isSynced ? 'border-emerald-500/40' : 'border-border/60',
                    ),
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
