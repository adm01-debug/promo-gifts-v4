/**
 * LogoColorAnalyzer — Componente reutilizável para análise de cores de logo
 * 
 * Mostra cores detectadas lado a lado com match Pantone,
 * com dropdown para trocar a cor Pantone manualmente.
 */

import { useState, useMemo } from 'react';
import { Loader2, Search, ChevronDown, AlertTriangle, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { searchPantone } from '@/data/pantone-coated';
import type { DetectedColor } from '@/hooks/simulation';

interface LogoColorAnalyzerProps {
  colors: DetectedColor[];
  isAnalyzing: boolean;
  error: string | null;
  onPantoneChange: (index: number, pantoneCode: string) => void;
  /** Max colors allowed by technique (optional) */
  maxColors?: number;
  className?: string;
}

export function LogoColorAnalyzer({
  colors,
  isAnalyzing,
  error,
  onPantoneChange,
  maxColors,
  className,
}: LogoColorAnalyzerProps) {
  if (isAnalyzing) {
    return (
      <div className={cn("flex items-center gap-3 py-6 justify-center", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Analisando cores da logo com IA...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center gap-2 py-4 text-destructive text-sm", className)}>
        <AlertTriangle className="h-4 w-4" />
        <span>{error}</span>
      </div>
    );
  }

  if (colors.length === 0) return null;

  const exceedsMax = maxColors !== null && colors.length > maxColors;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Cores Detectadas</span>
          <Badge variant="secondary" className="text-[10px]">
            {colors.length} cor{colors.length !== 1 ? 'es' : ''}
          </Badge>
        </div>
      </div>

      {/* Warning if exceeds max */}
      {exceedsMax && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-xs text-destructive">
            O número máximo de cores é <strong>{maxColors}</strong>. Substitua uma ou mais cores para continuar.
          </span>
        </div>
      )}

      {/* Color rows */}
      <div className="grid grid-cols-1 gap-2">
        {/* Column headers */}
        <div className="grid grid-cols-2 gap-2 px-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Cores Detectadas
          </span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Cores de Impressão
          </span>
        </div>

        {colors.map((color, index) => (
          <ColorRow
            key={index}
            color={color}
            index={index}
            onPantoneChange={onPantoneChange}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Color Row ───────────────────────────────────────────────────────

interface ColorRowProps {
  color: DetectedColor;
  index: number;
  onPantoneChange: (index: number, pantoneCode: string) => void;
}

function ColorRow({ color, index, onPantoneChange }: ColorRowProps) {
  return (
    <div className="grid grid-cols-2 gap-2 items-center">
      {/* Detected color */}
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
        <div
          className="w-6 h-6 rounded border border-border/50 shrink-0"
          style={{ backgroundColor: color.hex }}
        />
        <div className="min-w-0">
          <span className="text-xs font-medium truncate block">{color.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{color.hex}</span>
        </div>
      </div>

      {/* Pantone dropdown */}
      <PantoneDropdown
        selectedCode={color.selectedPantone}
        pantoneHex={color.pantoneMatch.pantoneHex}
        deltaE={color.pantoneMatch.deltaE}
        onChange={(code) => onPantoneChange(index, code)}
      />
    </div>
  );
}

// ─── Pantone Dropdown ────────────────────────────────────────────────

interface PantoneDropdownProps {
  selectedCode: string;
  pantoneHex: string;
  deltaE: number;
  onChange: (code: string) => void;
}

function PantoneDropdown({ selectedCode, pantoneHex, deltaE, onChange }: PantoneDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const results = useMemo(() => {
    const searched = searchPantone(search);
    // Ensure the currently selected code is always in results
    if (selectedCode && !searched.some(r => r.code === selectedCode)) {
      const selected = searchPantone(selectedCode).find(r => r.code === selectedCode);
      if (selected) return [selected, ...searched];
    }
    return searched;
  }, [search, selectedCode]);

  // Find the hex for the currently selected code
  const displayHex = useMemo(() => {
    const found = results.find(r => r.code === selectedCode);
    return found?.hex || pantoneHex;
  }, [results, selectedCode, pantoneHex]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/50 
                     hover:bg-muted/50 transition-colors w-full text-left"
         aria-label="Recolher">
          <div
            className="w-6 h-6 rounded border border-border/50 shrink-0"
            style={{ backgroundColor: displayHex }}
          />
          <span className="text-xs font-medium truncate flex-1">
            Pantone {selectedCode}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar Pantone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8 text-xs"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="h-[200px]">
          <div className="p-1">
            {results.map((p) => (
              <button
                key={p.code}
                onClick={() => {
                  onChange(p.code);
                  setOpen(false);
                  setSearch('');
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 rounded text-left text-xs",
                  "hover:bg-muted/80 transition-colors",
                  p.code === selectedCode && "bg-primary/10 font-medium"
                )}
              >
                <div
                  className="w-5 h-5 rounded border border-border/50 shrink-0"
                  style={{ backgroundColor: p.hex }}
                />
                <span className="flex-1">{p.code}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{p.hex}</span>
              </button>
            ))}
            {results.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhuma cor encontrada
              </p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
