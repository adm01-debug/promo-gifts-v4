import { useActiveCommemorativeDates, type CommemorativeDate } from '@/hooks/intelligence';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface CommemorativeDateFilterProps {
  selectedDates: string[];
  onToggleDate: (slug: string) => void;
  onClearDates?: () => void;
  className?: string;
  compact?: boolean;
}

/**
 * Componente de filtro para datas comemorativas ativas
 * Mostra apenas datas que estão no período de campanha (baseado em campaign_start_days)
 * Suporta multi-seleção
 */
export function CommemorativeDateFilter({
  selectedDates,
  onToggleDate,
  onClearDates,
  className,
  compact = false,
}: CommemorativeDateFilterProps) {
  const { data: activeDates, isLoading, error } = useActiveCommemorativeDates();

  // Não renderiza nada se não há datas ativas ou erro
  if (error) {
    console.error('Erro ao carregar datas comemorativas:', error);
    return null;
  }

  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-3/4 rounded-lg" />
      </div>
    );
  }

  if (!activeDates?.length) {
    return null; // Sem datas ativas, não mostra o filtro
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Botão limpar se tiver seleção */}
      {selectedDates.length > 0 && onClearDates && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClearDates}
            className="text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            Limpar ({selectedDates.length})
          </button>
        </div>
      )}

      {/* Lista de datas */}
      <div
        className={cn('overflow-y-auto overscroll-contain pr-2', compact ? 'max-h-40' : 'max-h-56')}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="space-y-1.5">
          {activeDates.map((date) => (
            <CommemorativeDateItem
              key={date.id}
              date={date}
              isSelected={selectedDates.includes(date.slug)}
              onSelect={() => onToggleDate(date.slug)}
              compact={compact}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CommemorativeDateItemProps {
  date: CommemorativeDate;
  isSelected: boolean;
  onSelect: () => void;
  compact?: boolean;
}

function CommemorativeDateItem({
  date,
  isSelected,
  onSelect,
  compact,
}: CommemorativeDateItemProps) {
  const daysUntilText = getDaysUntilText(date.days_until);

  return (
    <label className="group flex cursor-pointer items-center gap-3 py-1.5">
      {/* Checkbox visual */}
      <div
        className={cn(
          'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors',
          isSelected
            ? 'border-primary bg-primary'
            : 'border-muted-foreground/40 group-hover:border-primary/60',
        )}
        onClick={onSelect}
      >
        {isSelected && (
          <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6L5 9L10 3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Nome da data */}
      <span
        className={cn(
          'flex-1 truncate text-sm',
          isSelected
            ? 'font-medium text-foreground'
            : 'text-muted-foreground group-hover:text-foreground',
        )}
        onClick={onSelect}
      >
        {date.name}
      </span>

      {/* Countdown badge */}
      {daysUntilText && (
        <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {daysUntilText}
        </span>
      )}
    </label>
  );
}

function getDaysUntilText(daysUntil: number | null): string | null {
  if (daysUntil === null) return null;
  if (daysUntil === 0) return 'Hoje!';
  if (daysUntil === 1) return 'Amanhã';
  if (daysUntil <= 7) return `${daysUntil}d`;
  if (daysUntil <= 30) return `${Math.ceil(daysUntil / 7)}sem`;
  return `${Math.ceil(daysUntil / 30)}m`;
}

export default CommemorativeDateFilter;
