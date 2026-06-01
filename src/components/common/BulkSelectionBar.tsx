/**
 * BulkSelectionBar — Premium floating action bar for bulk selection.
 * Reusable across CollectionsPage and CollectionDetailPage.
 */
import { motion, AnimatePresence } from 'framer-motion';
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
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="sticky top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px))] z-30 overflow-hidden rounded-xl"
        >
          <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 px-5 py-4 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Left — Counter */}
              <div className="flex min-w-0 items-center gap-3">
                <motion.div
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 25 }}
                >
                  <span className="font-display text-lg font-bold">{selectedCount}</span>
                </motion.div>
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
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 }}
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onSelectAll}
                      className="gap-1.5 text-xs"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Selecionar Todos</span>
                    </Button>
                  </motion.div>
                )}

                {actions}

                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Button size="sm" variant="ghost" onClick={onClear} className="gap-1.5 text-xs">
                    <X className="h-3.5 w-3.5" />
                    Limpar
                  </Button>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
