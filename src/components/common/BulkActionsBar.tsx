import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export interface BulkAction {
  id: string;
  label: string;
  icon: ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  onClick: (ids: string[]) => void;
}

interface BulkActionsBarProps {
  selectedCount: number;
  selectedIds: string[];
  entityLabel?: string;
  actions: BulkAction[];
  onClear: () => void;
  /** Show "select all across pages" banner */
  showSelectAllBanner?: boolean;
  totalCount?: number;
  onSelectAll?: () => void;
}

export function BulkActionsBar({
  selectedCount,
  selectedIds,
  entityLabel = 'item',
  actions,
  onClear,
  showSelectAllBanner,
  totalCount,
  onSelectAll,
}: BulkActionsBarProps) {
  const pluralLabel = selectedCount === 1 ? entityLabel : `${entityLabel}s`;

  return (
    <>
      {selectedCount > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2">
            <span className="text-sm font-medium text-foreground">
              {selectedCount} {pluralLabel} selecionado{selectedCount !== 1 ? 's' : ''}
            </span>

            {actions.map((action) => (
              <Button
                key={action.id}
                variant={action.variant || 'secondary'}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => action.onClick([...selectedIds])}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}

            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={onClear}>
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          </div>

          {showSelectAllBanner && totalCount && onSelectAll && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
              <span>Todos desta página estão selecionados.</span>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onSelectAll}>
                Selecionar todos os {totalCount}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
