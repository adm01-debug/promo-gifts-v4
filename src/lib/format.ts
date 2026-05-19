/**
 * format.ts — Centralização de formatação e utilitários numéricos/monetários
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

/**
 * Formata um valor numérico como moeda BRL.
 */
export function formatCurrency(value: number): string {
  return BRL_FORMATTER.format(value);
}

/**
 * Formata um valor numérico como moeda BRL compacta (sem centavos).
 */
export function formatCurrencyCompact(value: number): string {
  return BRL_COMPACT_FORMATTER.format(value);
}

/**
 * Formata um preço unitário (ex: R$ 10,00/un).
 */
export function formatUnitPrice(value: number): string {
  return `${BRL_FORMATTER.format(value)}/un`;
}

/**
 * Arredondamento Half-up para 2 casas decimais.
 * SSOT para persistência monetária e cálculos de impostos/margens.
 */
export const round2 = (n: number | null | undefined): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
};

