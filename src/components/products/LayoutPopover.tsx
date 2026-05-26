import React from "react";
import { Settings2, LayoutGrid, List, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ColumnSelector, type ColumnCount } from "@/components/products/ColumnSelector";
import { cn } from "@/lib/utils";


const viewModes = [
  { value: "grid" as const, label: "Grid", icon: LayoutGrid },
  { value: "list" as const, label: "Lista", icon: List },
  { value: "table" as const, label: "Tabela", icon: Table2 },
];

interface LayoutPopoverProps {
  viewMode: "grid" | "list" | "table";
  setViewMode: (mode: "grid" | "list" | "table") => void;
  gridColumns: ColumnCount;
  setGridColumns: (cols: ColumnCount) => void;
}

export const LayoutPopover = React.forwardRef<HTMLDivElement, LayoutPopoverProps>(
  function LayoutPopover({ viewMode, setViewMode, gridColumns, setGridColumns }, ref) {
    return (
      <div ref={ref}>
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 bg-card/40 backdrop-blur-md" aria-label="Alterar layout">
                    <Settings2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-xs">Layout</span>
                  </Button>
                </PopoverTrigger>
              </span>
            </TooltipTrigger>
            <TooltipContent>Alterar visualização (grid, lista, tabela) e densidade de colunas</TooltipContent>
          </Tooltip>
          <PopoverContent align="end" className="w-60 p-4" sideOffset={8}>
            <div className="space-y-4">
              {/* View Mode */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Visualização
                </p>
                <div className="relative flex items-center gap-0.5 p-1 rounded-xl bg-muted/60 border border-border/40">
                  {viewModes.map((mode) => {
                    const Icon = mode.icon;
                    const isActive = viewMode === mode.value;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        aria-pressed={isActive}
                        className={cn(
                          "relative flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
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
              {viewMode === "grid" && (
                <>
                  <Separator className="opacity-50" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
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
  }
);
