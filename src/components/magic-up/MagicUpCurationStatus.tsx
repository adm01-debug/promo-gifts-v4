import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CURATION_STATUSES, type MagicUpCurationStatus } from '@/pages/magic-up/magicUpStrategy';
import { cn } from '@/lib/utils';

interface MagicUpCurationStatusProps {
  value: MagicUpCurationStatus;
  disabled?: boolean;
  onChange: (status: MagicUpCurationStatus) => void;
}

export function MagicUpCurationStatus({ value, disabled, onChange }: MagicUpCurationStatusProps) {
  const current = CURATION_STATUSES.find((status) => status.value === value);

  return (
    <section className="rounded-lg border bg-card p-3" aria-label="Status de curadoria">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold" id="curation-status-label">
          Curadoria
        </p>
        <Badge variant="outline" aria-live="polite">
          {current?.label || 'Rascunho'}
        </Badge>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="curation-status-label"
        tabIndex={0}
        className="mt-2 flex gap-1.5 overflow-x-auto rounded-md pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {CURATION_STATUSES.map((status) => {
          const active = status.value === value;
          return (
            <Button
              key={status.value}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              disabled={disabled}
              role="radio"
              aria-checked={active}
              aria-label={`Definir curadoria como ${status.label}`}
              className={cn(
                'h-7 shrink-0 px-2 text-[11px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100',
                active && 'shadow-sm',
              )}
              onClick={() => onChange(status.value)}
            >
              {status.label}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
