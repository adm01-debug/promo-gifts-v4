import { useMediaQuery } from '@/hooks/ui/useMediaQuery';
import type { ColumnCount } from '@/components/products/ColumnSelector';

export function colsToNum(cols: ColumnCount): number {
  return typeof cols === 'number' ? cols : 5;
}

/**
 * Hook reativo para obter o número real de colunas sendo exibidas baseado no breakpoint atual.
 * Deve estar em sincronia com getGridColsClass.
 */
export function useResponsiveColumns(cols: ColumnCount): number {
  const isSm = useMediaQuery('(min-width: 640px)');
  const isLg = useMediaQuery('(min-width: 1024px)');
  const isXl = useMediaQuery('(min-width: 1280px)');

  const baseCols = colsToNum(cols);

  switch (baseCols) {
    case 3:
      return isSm ? 3 : 2;
    case 4:
      if (isLg) return 4;
      if (isSm) return 3;
      return 2;
    case 5:
      if (isXl) return 5;
      if (isLg) return 4;
      if (isSm) return 3;
      return 2;
    case 6:
      if (isXl) return 6;
      if (isLg) return 5;
      if (isSm) return 4;
      return 3;
    case 8:
      if (isXl) return 8;
      if (isLg) return 6;
      if (isSm) return 4;
      return 3;
    default:
      // Padrão (5)
      if (isXl) return 5;
      if (isLg) return 4;
      if (isSm) return 3;
      return 2;
  }
}

const GRID_COLS_CLASS: Record<ColumnCount, string> = {
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  6: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  8: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8',
} as const;

export function getGridColsClass(cols: ColumnCount): string {
  return GRID_COLS_CLASS[cols] ?? GRID_COLS_CLASS[5];
}

export function getGridGapClass(cols: ColumnCount): string {
  if (cols >= 8) return 'gap-x-4 gap-y-8';
  if (cols >= 6) return 'gap-x-6 gap-y-8';
  return 'gap-x-8 gap-y-8';
}
