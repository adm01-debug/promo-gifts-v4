/**
 * QuotesStatusChips — chips horizontais com contador por status / flag de sync.
 * Sticky abaixo do header, scroll horizontal em mobile.
 *
 * A11y: container `role="toolbar"`, navegação por ← → Home End, foco visível
 * via `focus-visible:ring-*`, `aria-label` com label + contagem para leitores
 * de tela (evita o "Sincronizado1" colado).
 */
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { cn } from '@/lib/utils';
import type { Quote } from '@/hooks/quotes';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface QuotesStatusChipsProps {
  quotes: Quote[];
  value: string;
  onChange: (status: string) => void;
  /** Slot opcional renderizado à direita da barra (ex.: botão "Selecionar"). */
  rightSlot?: ReactNode;
}

type ChipDef = {
  key: string;
  label: string;
  match: (q: Quote) => boolean;
};

/**
 * Normaliza `synced_to_bitrix` — em dados legados o campo pode vir `null`/`undefined`.
 * Tratamos qualquer valor não-`true` como NÃO sincronizado.
 */
export const isSyncedToBitrix = (q: Pick<Quote, 'synced_to_bitrix'>): boolean =>
  q.synced_to_bitrix === true;

export const isAwaitingDiscountApproval = (q: Quote): boolean =>
  q.status === 'pending_approval' ||
  (q.status === 'pending' && q.discount_approval_status === 'pending');

export const isDiscountApproved = (q: Quote): boolean =>
  q.status === 'pending' && q.discount_approval_status === 'approved';

export const isDiscountRejected = (q: Quote): boolean =>
  q.status === 'pending' && q.discount_approval_status === 'rejected';

/**
 * Desconto que JÁ fora aprovado mas cuja validade expirou (DAR → 'expired',
 * espelhado em `quotes.discount_approval_status`). Orçamento volta a precisar
 * de re-aprovação. Antes da coluna materializada este estado sumia de todos os
 * filtros exceto "Todos".
 */
export const isDiscountExpired = (q: Quote): boolean =>
  q.status === 'pending' && q.discount_approval_status === 'expired';

/** True se o orçamento está em fluxo ativo de aprovação de desconto. */
export const hasDiscountWorkflow = (q: Quote): boolean =>
  q.status === 'pending_approval' ||
  // eslint-disable-next-line eqeqeq, no-eq-null -- checagem intencional de null/undefined
  (q.status === 'pending' && q.discount_approval_status != null);

/**
 * Estilos canônicos por chave visual de badge. Usado por `getQuoteRowBadge`
 * e pela legenda (`QUOTE_BADGE_LEGEND`).
 */
export const QUOTE_ROW_BADGE_STYLES = {
  draft: {
    label: 'Rascunho',
    className:
      'border-dashed border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-300',
    description:
      'Você ainda está montando este orçamento. Ele salva sozinho, mas o cliente ainda não vê nada.',
  },
  unsynced: {
    label: 'Criado (Não Sincronizado)',
    className:
      'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
    description:
      'Orçamento pronto, mas ainda não foi sincronizado com o Bitrix24.',
  },
  synced: {
    label: 'Criado/Sincronizado',
    className: 'border-primary/40 bg-primary/10 text-primary',
    description:
      'Tudo certo! Já está no CRM e o time comercial consegue ver. Pode seguir para o envio ao cliente.',
  },
  awaiting: {
    label: 'Aguardando Aprovação',
    className:
      'border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-300',
    description:
      'Orçamento com desconto acima do limite padrão da empresa, enviado para autorização do Gestor Comercial.',
  },
  approved: {
    label: 'Desconto Aprovado',
    className:
      'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    description:
      'Seu desconto foi liberado pelo gerente. Pode mandar o orçamento para o cliente!',
  },
  rejected: {
    label: 'Desconto Rejeitado',
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
    description:
      'O desconto não foi aprovado. Ajuste o valor ou alinhe com o gerente antes de enviar.',
  },
  expired: {
    label: 'Expirado',
    className: 'border-muted-foreground/30 bg-muted text-muted-foreground',
    description:
      'Passou da data de validade. Se o cliente ainda tiver interesse, renove ou faça um novo orçamento.',
  },
  expired_discount: {
    label: 'Desconto Expirado',
    className:
      'border-amber-600/40 bg-amber-600/10 text-amber-700 dark:text-amber-300',
    description:
      'A aprovação do desconto venceu. Peça uma nova liberação para o gerente antes de mandar para o cliente.',
  },
  sent: {
    label: 'Enviado',
    className: 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300',
    description: 'Orçamento já foi para o cliente. Agora é acompanhar e manter o contato ativo.',
  },
  viewed: {
    label: 'Visualizado',
    className: 'border-info/40 bg-info/10 text-info',
    description:
      'O cliente abriu seu orçamento. Bom momento para dar um toque e tirar dúvidas.',
  },
  quote_approved: {
    label: 'Aprovado',
    className: 'border-success/40 bg-success/10 text-success',
    description: 'O cliente aprovou o orçamento. Hora de fechar e transformar em pedido!',
  },
  converted: {
    label: 'Convertido em Pedido',
    className: 'border-success/50 bg-success/15 text-success',
    description: 'Virou pedido! Venda fechada — parabéns pelo resultado.',
  },
  cancelled: {
    label: 'Cancelado',
    className:
      'border-muted-foreground/30 bg-muted/50 text-muted-foreground line-through',
    description:
      'Você cancelou este orçamento. Ele não aparece mais no fluxo ativo de vendas.',
  },
  quote_rejected: {
    label: 'Rejeitado',
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
    description:
      'O cliente recusou o orçamento. Vale entender o motivo para acertar na próxima.',
  },
} as const;

export type QuoteRowBadgeKey = keyof typeof QUOTE_ROW_BADGE_STYLES;

export interface QuoteRowBadge {
  key: QuoteRowBadgeKey;
  label: string;
  className: string;
  description: string;
}

const withKey = (key: QuoteRowBadgeKey): QuoteRowBadge => ({
  key,
  ...QUOTE_ROW_BADGE_STYLES[key],
});

/**
 * Badge canônico de status da LINHA da tabela de orçamentos.
 * Cobre TODOS os 10 status canônicos + 3 derivações de desconto (DAR).
 * Nunca retorna null — sempre há um badge consistente.
 */
export function getQuoteRowBadge(q: Quote): QuoteRowBadge {
  if (isAwaitingDiscountApproval(q)) return withKey('awaiting');
  if (isDiscountApproved(q)) return withKey('approved');
  if (isDiscountRejected(q)) return withKey('rejected');
  if (isDiscountExpired(q)) return withKey('expired_discount');

  switch (q.status) {
    case 'draft':
      return withKey('draft');
    case 'pending':
      return isSyncedToBitrix(q) ? withKey('synced') : withKey('unsynced');
    case 'sent':
      return withKey('sent');
    case 'viewed':
      return withKey('viewed');
    case 'approved':
      return withKey('quote_approved');
    case 'converted':
      return withKey('converted');
    case 'rejected':
      return withKey('quote_rejected');
    case 'cancelled':
      return withKey('cancelled');
    case 'expired':
      return withKey('expired');
    default:
      return withKey('awaiting');
  }
}

/**
 * Itens da legenda visual exibida na página de orçamentos.
 * Ordem é a sequência canônica do ciclo de vida.
 */
export const QUOTE_BADGE_LEGEND: ReadonlyArray<QuoteRowBadge> = (
  [
    'draft',
    'unsynced',
    'synced',
    'awaiting',
    'approved',
    'rejected',
    'expired_discount',
    'sent',
    'viewed',
    'quote_approved',
    'converted',
    'quote_rejected',
    'expired',
    'cancelled',
  ] as const
).map(withKey);

const CHIPS: ChipDef[] = [
  { key: 'all', label: 'Todos', match: () => true },
  { key: 'draft', label: 'Rascunho', match: (q) => q.status === 'draft' },
  {
    key: 'unsynced',
    label: 'Criado (Não Sincronizado)',
    match: (q) =>
      q.status === 'pending' && !isSyncedToBitrix(q) && !hasDiscountWorkflow(q),
  },
  {
    key: 'created_synced',
    label: 'Criado/Sincronizado',
    match: (q) =>
      q.status === 'pending' && isSyncedToBitrix(q) && !hasDiscountWorkflow(q),
  },
  {
    key: 'pending_approval',
    label: 'Pendente Aprovação',
    match: isAwaitingDiscountApproval,
  },
  {
    key: 'discount_approved',
    label: 'Desconto Aprovado',
    match: isDiscountApproved,
  },
  {
    key: 'discount_rejected',
    label: 'Desconto Rejeitado',
    match: isDiscountRejected,
  },
  {
    key: 'discount_expired',
    label: 'Aprovação Expirada',
    match: isDiscountExpired,
  },
  { key: 'expired', label: 'Expirado', match: (q) => q.status === 'expired' },
];

export const QUOTE_CHIP_MATCHERS: Record<string, (q: Quote) => boolean> =
  Object.fromEntries(CHIPS.map((c) => [c.key, c.match]));

/**
 * Texto amigável (voltado para vendedor) exibido como tooltip ao passar
 * o mouse / focar nos chips de filtro do topo. Espelha o tom das
 * `description` de `QUOTE_ROW_BADGE_STYLES` (SSOT compartilhado).
 */
export const CHIP_TOOLTIPS: Record<string, string> = {
  all: 'Mostra todos os seus orçamentos, em qualquer fase.',
  draft: QUOTE_ROW_BADGE_STYLES.draft.description,
  unsynced: QUOTE_ROW_BADGE_STYLES.unsynced.description,
  created_synced: QUOTE_ROW_BADGE_STYLES.synced.description,
  pending_approval: QUOTE_ROW_BADGE_STYLES.awaiting.description,
  discount_approved: QUOTE_ROW_BADGE_STYLES.approved.description,
  discount_rejected: QUOTE_ROW_BADGE_STYLES.rejected.description,
  discount_expired: QUOTE_ROW_BADGE_STYLES.expired_discount.description,
  expired: QUOTE_ROW_BADGE_STYLES.expired.description,
};

/**
 * Copy de fallback exibida quando uma chave de chip/badge não tiver
 * tooltip mapeado. Garante que o `TooltipContent` nunca renderize vazio.
 */
export const TOOLTIP_FALLBACK_COPY =
  'Status sem descrição cadastrada. Avise o time se este aviso aparecer.';

/** Lookup seguro: nunca retorna string vazia. */
export const getChipTooltip = (key: string): string =>
  CHIP_TOOLTIPS[key]?.trim() || TOOLTIP_FALLBACK_COPY;

const log = createClientLogger('quotes.chips');
// Reporta no máximo uma vez por sessão para evitar spam de logs.
let reportedLegacySync = false;

export function QuotesStatusChips({ quotes, value, onChange, rightSlot }: QuotesStatusChipsProps) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const chip of CHIPS) {
      map[chip.key] = quotes.filter(chip.match).length;
    }
    return map;
  }, [quotes]);

  // Telemetria: detecta orçamentos com synced_to_bitrix null/undefined (dados legados).
  useEffect(() => {
    if (reportedLegacySync || quotes.length === 0) return;
    // eslint-disable-next-line eqeqeq, no-eq-null -- checagem intencional de null/undefined
    const legacy = quotes.filter((q) => q.synced_to_bitrix == null);
    if (legacy.length === 0) return;
    reportedLegacySync = true;
    log.warn('synced_to_bitrix_legacy_detected', {
      legacy_count: legacy.length,
      total: quotes.length,
      sample_ids: legacy.slice(0, 5).map((q) => q.id),
    });
  }, [quotes]);

  const visibleChips = CHIPS.filter(({ key }) => {
    const isActive = value === key;
    const count = counts[key] || 0;
    return key === 'all' || isActive || count > 0;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  // Scroll horizontal via mouse wheel nos chips de status (fix_version horizontal-scroll-hook-v1)
  useHorizontalScroll(containerRef);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>(
      'button[data-chip-key]',
    );
    if (!buttons || buttons.length === 0) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % buttons.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + buttons.length) % buttons.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = buttons.length - 1;
    if (next === -1) return;
    e.preventDefault();
    buttons[next]?.focus();
  };

  return (
    <TooltipProvider delayDuration={250}>
    <div className="sticky top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px))] z-20 -mx-1 border-b border-border/40 bg-background/85 px-1 py-2 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div
          ref={containerRef}
          role="toolbar"
          aria-label="Filtrar orçamentos por status e sincronização"
          aria-orientation="horizontal"
          className="scrollbar-thin flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
        >
          {visibleChips.map(({ key, label }, idx) => {
            const isActive = value === key;
            const count = counts[key] || 0;
            const isApproved = key === 'discount_approved';
            const isRejected = key === 'discount_rejected';
            const isPendingApproval = key === 'pending_approval';
            const isDiscountExpiredChip = key === 'discount_expired';
            const accentBorder = isApproved
              ? 'border-emerald-500/40'
              : isRejected
                ? 'border-destructive/40'
                : isPendingApproval
                  ? 'border-amber-500/40'
                  : isDiscountExpiredChip
                    ? 'border-amber-500/30'
                    : 'border-border/60';
            const ariaLabel = isPendingApproval
              ? `${label} (aguardando aprovação de desconto), ${count} ${count === 1 ? 'orçamento' : 'orçamentos'}`
              : `${label}, ${count} ${count === 1 ? 'orçamento' : 'orçamentos'}`;

            return (
              <Tooltip key={key} delayDuration={250}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-chip-key={key}
                    data-testid={`quotes-chip-${key}`}
                    onClick={() => onChange(key)}
                    onKeyDown={(e) => handleKeyDown(e, idx)}
                    aria-pressed={isActive}
                    aria-label={ariaLabel}
                    className={cn(
                      'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all',
                      'whitespace-nowrap border outline-none',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : cn(
                            'bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                            accentBorder,
                          ),
                    )}
                  >
                    <span aria-hidden="true">{label}</span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums',
                        isActive
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-foreground/70',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  data-testid={`quotes-chip-tooltip-${key}`}
                  className="max-w-[260px] text-xs"
                >
                  {getChipTooltip(key)}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
    </div>
    </TooltipProvider>
  );
}
