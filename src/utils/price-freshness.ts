/**
 * Price Freshness Utility
 *
 * Computes how stale a product's price is, based on the last update timestamp
 * coming from the external catalog DB (SSOT). Used by `PriceFreshnessBadge`
 * across the PDP, catalog cards, quick view, sticky header and quote builder.
 */

export type PriceFreshnessStatus = 'aging' | 'fresh' | 'stale' | 'unknown';

export interface PriceFreshness {
  status: PriceFreshnessStatus;
  daysSinceUpdate: number | null;
  thresholdDays: number;
  /** Short label suitable for inline rendering, e.g. "Preço atualizado há 12 dias". */
  label: string;
  /** Long-form tooltip text with absolute date + threshold context. */
  tooltip: string;
  /** True for `aging` and `stale` — UI may use this to decide if it should render. */
  shouldWarn: boolean;
  /** True for `stale` only — UI may escalate the warning copy/color. */
  isStale: boolean;
}

export const DEFAULT_PRICE_FRESHNESS_THRESHOLD_DAYS = 60;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Formato curto numérico — usado em layouts compactos (sticky header,
 * tabela de orçamento, cards). Ex.: "20/03/2026".
 */
export function formatPriceDateShort(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Formato longo por extenso — padrão PT-BR usado em destaques (PDP,
 * tooltips, avisos). Ex.: "20 de março de 2026".
 */
export function formatPriceDateLong(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatRelativeDays(days: number): string {
  if (days === 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}

export function getPriceFreshness(
  priceUpdatedAt: Date | string | null | undefined,
  thresholdDays: number | null | undefined,
): PriceFreshness {
  const threshold =
    typeof thresholdDays === 'number' && thresholdDays > 0
      ? Math.floor(thresholdDays)
      : DEFAULT_PRICE_FRESHNESS_THRESHOLD_DAYS;

  if (!priceUpdatedAt) {
    return {
      status: 'unknown',
      daysSinceUpdate: null,
      thresholdDays: threshold,
      label: 'Data de atualização não informada',
      tooltip:
        'O fornecedor não informou quando este preço foi atualizado pela última vez. Confirme o valor diretamente com o fornecedor antes de enviar o orçamento ao cliente.',
      shouldWarn: false,
      isStale: false,
    };
  }

  const date = priceUpdatedAt instanceof Date ? priceUpdatedAt : new Date(priceUpdatedAt);

  if (Number.isNaN(date.getTime())) {
    return {
      status: 'unknown',
      daysSinceUpdate: null,
      thresholdDays: threshold,
      label: 'Data de atualização inválida',
      tooltip:
        'A data informada pelo fornecedor é inválida. Confirme o valor diretamente com o fornecedor antes de enviar o orçamento ao cliente.',
      shouldWarn: false,
      isStale: false,
    };
  }

  const diffMs = Date.now() - date.getTime();
  const days = Math.max(0, Math.floor(diffMs / MS_PER_DAY));
  const absoluteLong = formatPriceDateLong(date);
  const relative = formatRelativeDays(days);

  let status: PriceFreshnessStatus;
  // BUG-008: > excluded the exact threshold day (e.g. day 60 with threshold=60
  // was 'aging' instead of 'stale'). >= matches the stated policy.
  if (days >= threshold) status = 'stale';
  else if (days > Math.floor(threshold / 2)) status = 'aging';
  else status = 'fresh';

  // Copy curto e consistente entre PDP e Quick View: "Atualizado <relativo>".
  // A data absoluta fica no tooltip para evitar poluição visual. Usado tanto
  // para `fresh` quanto para `aging` (o alerta de aging vem da cor/ícone, não
  // do texto). O status `stale` tem copy próprio com chamada de ação.
  const baseLabel = `Atualizado ${relative}`;
  // Tooltip padronizado para todos os status: data por extenso + janela de
  // validade configurada para este produto. Mensagem escrita para o vendedor:
  // direta, sem jargão técnico, sem repetir o número de dias.
  const baseTooltip = `Última atualização do preço pelo fornecedor: ${absoluteLong} (${relative}). Validade configurada: ${threshold} dias.`;

  if (status === 'stale') {
    return {
      status,
      daysSinceUpdate: days,
      thresholdDays: threshold,
      label: `Preço pode estar defasado (${relative})`,
      tooltip: `${baseTooltip} O prazo de validade já foi ultrapassado — confirme o valor com o fornecedor antes de enviar o orçamento ao cliente.`,
      shouldWarn: true,
      isStale: true,
    };
  }

  if (status === 'aging') {
    return {
      status,
      daysSinceUpdate: days,
      thresholdDays: threshold,
      label: baseLabel,
      tooltip: `${baseTooltip} Está se aproximando do limite — recomendamos confirmar o valor com o fornecedor antes de fechar o orçamento.`,
      shouldWarn: true,
      isStale: false,
    };
  }

  return {
    status,
    daysSinceUpdate: days,
    thresholdDays: threshold,
    label: baseLabel,
    tooltip: `${baseTooltip} Preço dentro do prazo de validade.`,
    shouldWarn: false,
    isStale: false,
  };
}
