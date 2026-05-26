/**
 * Helpers for VariantGridMatrix
 */

export const SIZE_ORDER = [
  'PP',
  'P',
  'M',
  'G',
  'GG',
  'XG',
  'XXG',
  'EG',
  'EGG',
  'XS',
  'S',
  'L',
  'XL',
  'XXL',
  '2XL',
  '3XL',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '100ml',
  '200ml',
  '300ml',
  '350ml',
  '400ml',
  '500ml',
  '600ml',
  '750ml',
  '1L',
];

export function getSizeOrder(code: string): number {
  const upper = code.toUpperCase().trim();
  const idx = SIZE_ORDER.indexOf(upper);
  if (idx >= 0) return idx;
  const num = parseFloat(upper);
  if (!isNaN(num)) return 1000 + num;
  return 2000;
}

export function isLightColor(hex?: string | null): boolean {
  if (!hex) return true;
  const c = hex.replace('#', '');
  if (c.length < 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

export function formatStock(stock: number): string {
  if (stock === 0) return '0';
  if (stock >= 1000) return `${(stock / 1000).toFixed(1)}k`;
  return stock.toLocaleString('pt-BR');
}

export function stockColor(stock: number): string {
  if (stock === 0) return 'text-destructive';
  if (stock < 100) return 'text-warning';
  return 'text-success';
}
