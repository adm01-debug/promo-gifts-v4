/**
 * QuotesStatusChips — chips horizontais com contador por status / flag de sync.
 * Sticky abaixo do header, scroll horizontal em mobile.
 *
 * A11y: container `role="toolbar"`, navegação por ← → Home End, foco visível
 * via `focus-visible:ring-*`, `aria-label` com label + contagem para leitores
 * de tela (evita o "Sincronizado1" colado).
 */
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Quote } from '@/hooks/quotes';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

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
  (q.status === 'pending' && q.discount_approval_status != null);

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
              <button
                key={key}
                type="button"
                data-chip-key={key}
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
            );
          })}
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
    </div>
  );
}
