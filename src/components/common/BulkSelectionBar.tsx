/**
 * BulkSelectionBar — Premium floating action bar for bulk selection.
 * Reusable across CollectionsPage and CollectionDetailPage.
 */

import { CheckSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';

interface BulkSelectionBarProps {
  isActive: boolean;
  selectedCount: number;
  /** Primary label, e.g. "2 produtos selecionados" */
  label: string;
  /** Secondary description */
  subtitle?: string;
  /** Action buttons (right side) */
  actions: ReactNode;
  /** Total items for "select all" logic */
  totalCount?: number;
  onSelectAll?: () => void;
  onClear: () => void;
}

export function BulkSelectionBar({
  isActive,
  selectedCount,
  label,
  subtitle,
  actions,
  totalCount,
  onSelectAll,
  onClear,
}: BulkSelectionBarProps) {
  return (
    <>
      {isActive && (
        <div className="sticky top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px))] z-30 overflow-hidden rounded-xl">
          <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 px-5 py-4 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Left — Counter */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                  <span className="font-display text-lg font-bold">{selectedCount}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-foreground">{label}</p>
                  {subtitle && (
                    <p className="max-w-[300px] truncate text-xs text-muted-foreground">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Right — Actions */}
              <div className="flex items-center gap-2">
                {onSelectAll && totalCount !== undefined && selectedCount < totalCount && (
                  <div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onSelectAll}
                      className="gap-1.5 text-xs"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Selecionar Todos</span>
                    </Button>
                  </div>
                )}

                {actions}

                <div>
                  <Button size="sm" variant="ghost" onClick={onClear} className="gap-1.5 text-xs">
                    <X className="h-3.5 w-3.5" />
                    Limpar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
