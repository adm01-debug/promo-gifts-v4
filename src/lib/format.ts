/**
 * Formatação de moeda centralizada
 */

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const BRL_COMPACT_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  return BRL_FORMATTER.format(value);
}

export function formatCurrencyCompact(value: number): string {
  return BRL_COMPACT_FORMATTER.format(value);
}

export function formatUnitPrice(value: number): string {
  return `${BRL_FORMATTER.format(value)}/un`;
}
