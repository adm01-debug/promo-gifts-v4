/**
 * SSOT das mensagens de validação do desconto no Quote Builder.
 *
 * Estados possíveis (em ordem de precedência):
 *   - `invalid_over_100`  → vendedor digitou valor > 100 (ex.: 1000).
 *   - `invalid_negative`  → valor negativo (não deveria acontecer pelo input,
 *                           mas validamos defensivamente).
 *   - `exceeds_limit`     → realDiscountPercent > maxDiscountPercent.
 *                           Aqui a regra de negócio dispara o fluxo de alçada.
 *   - `markup_hint`       → vendedor está aplicando desconto aparente alto mas
 *                           a Margem de Negociação está desligada — o desconto
 *                           real cresce; explica como reduzir.
 *   - `within_limit`      → tudo certo, mensagem positiva discreta.
 *   - `idle`              → sem desconto aplicado; nada a mostrar.
 *
 * Estes textos são consumidos pela UI (`QuoteBuilderSummaryColumn`) e cobertos
 * por testes unitários (`discount-validation-messages.test.ts`).
 */

export type DiscountValidationKind =
  | 'idle'
  | 'within_limit'
  | 'markup_hint'
  | 'exceeds_limit'
  | 'invalid_negative'
  | 'invalid_over_100';

export type DiscountValidationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface DiscountValidationInput {
  /** Valor cru digitado no input (em %, mesmo se o tipo for R$ a UI converte antes). */
  rawPercent: number;
  /** Desconto efetivo sobre o custo real (depois do markup). */
  realDiscountPercent: number;
  /** Limite do vendedor (sem precisar de aprovação). `null` = sem limite definido. */
  maxDiscountPercent: number | null;
  /** Flag: a Margem de Negociação está ligada? */
  hasMarkup: boolean;
  /** Markup percentual aplicado (0 se desligado). Usado para a dica. */
  markupPercent?: number;
}

export interface DiscountValidationMessage {
  kind: DiscountValidationKind;
  severity: DiscountValidationSeverity;
  title: string;
  description: string;
  /** Texto curto do que o vendedor precisa fazer para destravar o save. */
  callToAction: string | null;
}

function fmt(n: number): string {
  // Mostra até 2 casas, mas remove zeros à direita ("10" e não "10,00").
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function getDiscountValidationMessage(
  input: DiscountValidationInput,
): DiscountValidationMessage {
  const { rawPercent, realDiscountPercent, maxDiscountPercent, hasMarkup, markupPercent = 0 } =
    input;

  // 1) Inválidos primeiro — bloqueiam qualquer save.
  if (Number.isNaN(rawPercent) || !Number.isFinite(rawPercent)) {
    return {
      kind: 'invalid_over_100',
      severity: 'error',
      title: 'Valor inválido',
      description: 'Informe um percentual numérico entre 0 e 100.',
      callToAction: 'Ajuste o desconto para um valor entre 0% e 100%.',
    };
  }
  if (rawPercent < 0) {
    return {
      kind: 'invalid_negative',
      severity: 'error',
      title: 'Valor inválido',
      description: 'O desconto não pode ser negativo.',
      callToAction: 'Ajuste o desconto para um valor entre 0% e 100%.',
    };
  }
  if (rawPercent > 100) {
    return {
      kind: 'invalid_over_100',
      severity: 'error',
      title: 'Valor inválido',
      description: `O desconto não pode ultrapassar 100% (você digitou ${fmt(rawPercent)}%).`,
      callToAction: 'Ajuste o desconto para um valor entre 0% e 100%.',
    };
  }

  // 2) Sem desconto efetivo → nada a sinalizar.
  if (rawPercent === 0 && realDiscountPercent <= 0) {
    return {
      kind: 'idle',
      severity: 'info',
      title: '',
      description: '',
      callToAction: null,
    };
  }

  // 3) Acima do limite do vendedor → dispara alçada.
  if (maxDiscountPercent !== null && realDiscountPercent > maxDiscountPercent) {
    const description = hasMarkup
      ? `Desconto real ${fmt(realDiscountPercent)}% ultrapassa seu limite de ${fmt(maxDiscountPercent)}%. ` +
        `A Margem de Negociação (${fmt(markupPercent)}%) já foi considerada.`
      : `Desconto real ${fmt(realDiscountPercent)}% ultrapassa seu limite de ${fmt(maxDiscountPercent)}%.`;

    return {
      kind: 'exceeds_limit',
      severity: 'warning',
      title: 'Acima do seu limite — requer aprovação do gestor',
      description,
      callToAction:
        'Clique em “Solicitar Aprovação”, justifique (mín. 10 caracteres) e envie ao gestor comercial.',
    };
  }

  // 4) Dica: vendedor poderia reduzir o desconto real ligando a margem.
  if (
    !hasMarkup &&
    maxDiscountPercent !== null &&
    realDiscountPercent > maxDiscountPercent * 0.7 &&
    realDiscountPercent <= maxDiscountPercent
  ) {
    return {
      kind: 'markup_hint',
      severity: 'info',
      title: 'Quase no limite',
      description: `Desconto real ${fmt(realDiscountPercent)}% — perto do seu teto de ${fmt(maxDiscountPercent)}%.`,
      callToAction:
        'Para reduzir o desconto real sem mexer no preço final, ative a Margem de Negociação.',
    };
  }

  // 5) Tudo certo.
  const remaining =
    maxDiscountPercent !== null ? Math.max(0, maxDiscountPercent - realDiscountPercent) : null;
  return {
    kind: 'within_limit',
    severity: 'success',
    title: '',
    description:
      maxDiscountPercent !== null
        ? `Dentro do seu limite de ${fmt(maxDiscountPercent)}% (real: ${fmt(realDiscountPercent)}%). Faltam ${fmt(remaining ?? 0)}% para atingir o teto.`
        : `Desconto real: ${fmt(realDiscountPercent)}%.`,
    callToAction: null,
  };
}


/**
 * Checklist para habilitar o botão “Solicitar Aprovação”.
 * Cada item retorna `ok: boolean` + `label`.
 */
export interface ApprovalReadinessInput {
  hasItems: boolean;
  hasClient: boolean;
  sellerNotesLength: number;
}

export interface ApprovalChecklistItem {
  key: 'items' | 'client' | 'notes';
  ok: boolean;
  label: string;
}

export const MIN_SELLER_NOTES_LENGTH = 10;

export function getApprovalChecklist(input: ApprovalReadinessInput): ApprovalChecklistItem[] {
  return [
    { key: 'items', ok: input.hasItems, label: 'Adicionar ao menos 1 item ao orçamento' },
    { key: 'client', ok: input.hasClient, label: 'Selecionar empresa/cliente' },
    {
      key: 'notes',
      ok: input.sellerNotesLength >= MIN_SELLER_NOTES_LENGTH,
      label: `Escrever justificativa para o gestor (mín. ${MIN_SELLER_NOTES_LENGTH} caracteres)`,
    },
  ];
}

export function isApprovalReady(input: ApprovalReadinessInput): boolean {
  return getApprovalChecklist(input).every((item) => item.ok);
}
