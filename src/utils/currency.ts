/**
 * currency.ts — Utilitários de formatação de moeda para o padrão PT-BR.
 *
 * Centraliza a lógica de formatação para evitar inconsistências como
 * "R$120.00" vs "R$ 120,00" em diferentes partes da aplicação.
 *
 * @example
 *   formatBRL(1234.5)   // "R$ 1.234,50"
 *   formatBRLShort(1234.5) // "R$ 1.235"  (Math.round usa half-up em JS)
 *   parseBRL("R$ 1.234,50") // 1234.5
 */

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const BRL_FORMATTER_NO_CENTS = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  compactDisplay: 'short',
});

/**
 * Formata um valor numérico como moeda brasileira.
 * @example formatBRL(1234.5) → "R$ 1.234,50"
 */
export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'R$ 0,00';
  return BRL_FORMATTER.format(value);
}

/**
 * Formata sem centavos (arredonda para inteiro).
 * @example formatBRLShort(1234.5) → "R$ 1.235"
 */
export function formatBRLShort(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'R$ 0';
  return BRL_FORMATTER_NO_CENTS.format(Math.round(value));
}

/**
 * Formata em notação compacta.
 * @example formatBRLCompact(1234567) → "R$ 1,2 mi"
 */
export function formatBRLCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'R$ 0';
  return BRL_COMPACT.format(value);
}

/**
 * Converte uma string de moeda PT-BR de volta para número.
 * @example parseBRL("R$ 1.234,50") → 1234.5
 */
export function parseBRL(str: string): number {
  // Remove símbolo de moeda, pontos de milhar; troca vírgula decimal por ponto
  const cleaned = str.replace(/[R$\s.]/g, '').replace(',', '.');
  const result = parseFloat(cleaned);
  return Number.isNaN(result) ? 0 : result;
}
