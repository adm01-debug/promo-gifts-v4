import { cn } from '@/lib/utils';

export type DeliveryMode = 'data' | 'prazo';

export interface DeliveryModeToggleProps {
  value: DeliveryMode;
  onChange: (mode: DeliveryMode) => void;
  className?: string;
}

/**
 * Toggle "Contar dias | Data fixa" do bloco Prazo | Entrega no QuoteBuilder.
 * Extraído para permitir teste isolado sem carregar a página inteira.
 */
export function DeliveryModeToggle({ value, onChange, className }: DeliveryModeToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Modo de prazo de entrega"
      data-testid="delivery-mode-toggle"
      className={cn(
        'inline-flex items-center rounded-lg border border-border/40 bg-muted/30 p-0.5',
        className,
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'prazo'}
        onClick={() => onChange('prazo')}
        className={cn(
          'rounded-md px-2.5 py-0.5 text-[11px] font-semibold transition-all',
          value === 'prazo'
            ? 'bg-background text-primary shadow-sm ring-1 ring-border/50'
            : 'text-muted-foreground hover:bg-muted/50',
        )}
      >
        Contar dias
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'data'}
        onClick={() => onChange('data')}
        className={cn(
          'rounded-md px-2.5 py-0.5 text-[11px] font-semibold transition-all',
          value === 'data'
            ? 'bg-background text-primary shadow-sm ring-1 ring-border/50'
            : 'text-muted-foreground hover:bg-muted/50',
        )}
      >
        Data fixa
      </button>
    </div>
  );
}
