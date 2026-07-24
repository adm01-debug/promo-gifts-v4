import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'product-grid-columns';

export type ColumnCount = 3 | 4 | 5 | 6 | 8;

function GridIcon({ cols, rows = 2 }: { cols: number; rows?: number }) {
  const size = 18;
  const gap = 2;
  const cellW = (size - (cols - 1) * gap) / cols;
  const cellH = (size - (rows - 1) * gap) / rows;
  const rects: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rects.push(
        <rect
          key={`${r}-${c}`}
          x={c * (cellW + gap)}
          y={r * (cellH + gap)}
          width={cellW}
          height={cellH}
          rx={1}
          fill="currentColor"
        />,
      );
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rects}
    </svg>
  );
}

interface ColumnOption {
  value: ColumnCount;
  label: string;
  cols: number;
  rows: number;
  /** Largura mínima da tela (px) para que essa opção fique disponível. */
  minWidth: number;
}

// Breakpoints reduzidos para garantir que TODAS as 5 opções (3/4/5/6/8)
// fiquem disponíveis em telas comuns de desktop (≥1280px largura útil).
const columnOptions: ColumnOption[] = [
  { value: 3, label: '3 colunas', cols: 3, rows: 2, minWidth: 0 },
  { value: 4, label: '4 colunas', cols: 4, rows: 2, minWidth: 640 },
  { value: 5, label: '5 colunas', cols: 5, rows: 2, minWidth: 900 },
  { value: 6, label: '6 colunas', cols: 3, rows: 3, minWidth: 1100 },
  { value: 8, label: '8 colunas', cols: 4, rows: 3, minWidth: 1280 },
];

function getAvailableOptions(screenWidth: number): ColumnOption[] {
  return columnOptions.filter((opt) => screenWidth >= opt.minWidth);
}

function getDefaultColumns(): ColumnCount {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = Number(saved) as ColumnCount;
      if ([3, 4, 5, 6, 8].includes(parsed)) return parsed;
    }
  } catch {
    /* empty */
  }
  if (typeof window !== 'undefined') {
    const w = window.innerWidth;
    if (w < 1024) return 3;
  }
  return 5;
}

interface ColumnSelectorProps {
  value: ColumnCount;
  onChange: (cols: ColumnCount) => void;
  className?: string;
}

export function ColumnSelector({ value, onChange, className }: ColumnSelectorProps) {
  // Track window width to filter options responsively.
  const [screenWidth, setScreenWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1600,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const available = getAvailableOptions(screenWidth);

  // Clamping: se o valor controlado ultrapassa o máximo disponível para a
  // largura atual, dispara onChange para o maior valor permitido. Mantém
  // a UI consistente quando a tela encolhe ou o valor vem maior do esperado.
  useEffect(() => {
    if (available.length === 0) return;
    const maxAvailable = available[available.length - 1].value;
    if (value > maxAvailable) {
      onChange(maxAvailable);
    }
  }, [value, available, onChange]);

  // Quando só sobra 1 opção (ou nenhuma), o seletor não tem utilidade.
  if (available.length <= 1) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Número de colunas"
      data-testid="column-selector"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-xl border border-border/40 bg-muted/60 p-1',
        className,
      )}
    >
      {available.map((opt) => {
        const isActive = value === opt.value;
        return (
          <Tooltip key={opt.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-label={opt.label}
                aria-checked={isActive}
                data-testid={`column-option-${opt.value}`}
                className={cn(
                  'relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChange(opt.value);
                    try {
                      localStorage.setItem(STORAGE_KEY, String(opt.value));
                    } catch {
                      /* empty */
                    }
                  }
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(opt.value);
                  try {
                    localStorage.setItem(STORAGE_KEY, String(opt.value));
                  } catch {
                    /* empty */
                  }
                }}
              >
                <GridIcon cols={opt.cols} rows={opt.rows} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{opt.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export { getDefaultColumns, STORAGE_KEY };
