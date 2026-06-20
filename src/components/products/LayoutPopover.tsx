import React from 'react';
import { Settings2, LayoutGrid, List, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ColumnSelector, type ColumnCount } from '@/components/products/ColumnSelector';
import { cn } from '@/lib/utils';

const viewModes = [
  { value: 'grid' as const, label: 'Grid', icon: LayoutGrid },
  { value: 'list' as const, label: 'Lista', icon: List },
  { value: 'table' as const, label: 'Tabela', icon: Table2 },
];

interface LayoutPopoverProps {
  viewMode: 'grid' | 'list' | 'table';
  setViewMode: (mode: 'grid' | 'list' | 'table') => void;
  gridColumns: ColumnCount;
  setGridColumns: (cols: ColumnCount) => void;
}

export const LayoutPopover = React.forwardRef<HTMLDivElement, LayoutPopoverProps>(
  ({ viewMode, setViewMode, gridColumns, setGridColumns }, ref) => {
    return (
      <div ref={ref}>
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 bg-card/40 backdrop-blur-sm sm:h-9"
                    aria-label="Alterar layout"
                    data-testid="layout-popover-trigger"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    <span className="hidden text-xs sm:inline">Layout</span>
                  </Button>
                </PopoverTrigger>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Alterar visualização (grid, lista, tabela) e densidade de colunas
            </TooltipContent>
          </Tooltip>
          <PopoverContent
            align="end"
            className="w-60 border-primary/10 p-4 shadow-2xl"
            sideOffset={8}
          >
            <div className="space-y-4">
              {/* View Mode */}
              <div>
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Visualização
                </p>
                <div className="relative flex items-center gap-0.5 rounded-xl border border-border/40 bg-muted/60 p-1">
                  {viewModes.map((mode) => {
                    const Icon = mode.icon;
                    const isActive = viewMode === mode.value;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        aria-pressed={isActive}
                        className={cn(
                          'relative flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-background/50 hover:text-foreground',
                        )}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setViewMode(mode.value);
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Column Selector - only in grid mode */}
              {viewMode === 'grid' && (
                <>
                  <Separator className="opacity-50" />
                  <div>
                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Colunas
                    </p>
                    <ColumnSelector value={gridColumns} onChange={setGridColumns} />
                  </div>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);
