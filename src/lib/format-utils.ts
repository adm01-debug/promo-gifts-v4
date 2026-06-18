/**
 * Utilitários para formatação de dados em tooltips e displays
 */

/**
 * Formata números com fallback para "Sem dados"
 * @param value Valor numérico
 * @param decimals Casas decimais (padrão 0)
 * @returns String formatada ou "Sem dados"
 */
export function formatTooltipNumber(value: number | undefined | null, decimals = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return 'Sem dados';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formata percentuais com sinal e sufixo
 */
export function formatTooltipPercent(value: number | undefined | null, decimals = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return 'Sem dados';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatTooltipNumber(value, decimals)}%`;
}

/**
 * Formata moeda R$
 */
export function formatTooltipCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return 'Sem dados';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
