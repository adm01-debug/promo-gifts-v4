import type { ColumnCount } from '@/components/products/ColumnSelector';

export function colsToNum(cols: ColumnCount): number {
  return typeof cols === 'number' ? cols : 5;
}

export function getGridColsClass(cols: ColumnCount): string {
  const map: Record<ColumnCount, string> = {
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
    6: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
    8: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8',
  };

  return map[cols] ?? map[5];
}

export function getGridGapClass(cols: ColumnCount): string {
  if (cols >= 8) return 'gap-x-4 gap-y-8';
  if (cols >= 6) return 'gap-x-6 gap-y-8';
  return 'gap-x-8 gap-y-8';
}
