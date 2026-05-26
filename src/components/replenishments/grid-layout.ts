import { COLUMN_CLASSES, type ColumnCount } from "@/components/products/ColumnSelector";

export function colsToNum(cols: ColumnCount): number {
  return typeof cols === "number" ? cols : 5;
}

export function getGridColsClass(cols: ColumnCount): string {
  return COLUMN_CLASSES[cols] ?? COLUMN_CLASSES[5];
}

export function getGridGapClass(cols: ColumnCount): string {
  if (cols >= 8) return "gap-x-4 gap-y-8";
  if (cols >= 6) return "gap-x-6 gap-y-8";
  return "gap-x-8 gap-y-8";
}
