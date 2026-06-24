/**
 * Configuração centralizada de status de orçamentos
 * Fonte única de verdade para labels, cores, estilos e transições válidas.
 */
import type { QuoteStatus } from '@/types/quote';

export interface QuoteStatusConfig {
  label: string;
  /** HSL color token for charts / icons */
  color: string;
  /** Badge variant for QuoteViewPage */
  badgeVariant: 'default' | 'destructive' | 'outline' | 'secondary';
  /** Tailwind classes for list badges (bg + text + border) */
  badgeClassName: string;
  /** Lucide icon name hint (optional, for future use) */
  icon?: string;
}

export const QUOTE_STATUS_CONFIG: Record<string, QuoteStatusConfig> = {
  draft: {
    label: 'Rascunho',
    color: 'hsl(var(--muted-foreground))',
    badgeVariant: 'secondary',
    badgeClassName: 'bg-warning/10 text-warning border-warning/40 border-dashed',
  },
  pending_approval: {
    label: 'Aguardando Aprovação',
    color: 'hsl(38, 92%, 50%)',
    badgeVariant: 'outline',
    badgeClassName: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    icon: 'shield',
  },
  pending: {
    label: 'Pendente',
    color: 'hsl(var(--warning))',
    badgeVariant: 'outline',
    badgeClassName: 'bg-info/15 text-info border-info/30',
    icon: 'pulse',
  },
  sent: {
    label: 'Enviado',
    color: 'hsl(var(--info))',
    badgeVariant: 'default',
    badgeClassName: 'bg-primary/15 text-primary border-primary/30',
  },
  approved: {
    label: 'Aprovado',
    color: 'hsl(var(--success))',
    badgeVariant: 'default',
    badgeClassName: 'bg-success/15 text-success border-success/30',
  },
  converted: {
    label: 'Convertido em Pedido',
    color: 'hsl(var(--success))',
    badgeVariant: 'default',
    badgeClassName: 'bg-success/15 text-success border-success/30',
  },
  viewed: {
    label: 'Visualizado',
    color: 'hsl(var(--info))',
    badgeVariant: 'outline',
    badgeClassName: 'bg-info/10 text-info border-info/30',
    icon: 'eye',
  },
  rejected: {
    label: 'Rejeitado',
    color: 'hsl(var(--destructive))',
    badgeVariant: 'destructive',
    badgeClassName: 'bg-destructive/15 text-destructive border-destructive/30',
  },
  expired: {
    label: 'Expirado',
    color: 'hsl(var(--muted-foreground))',
    badgeVariant: 'secondary',
    badgeClassName: 'bg-muted text-muted-foreground border-muted',
  },
  cancelled: {
    label: 'Cancelado',
    color: 'hsl(var(--muted-foreground))',
    badgeVariant: 'outline',
    badgeClassName: 'bg-muted/50 text-muted-foreground border-muted line-through',
  },
};

/** Helper: get status label with fallback */
export function getQuoteStatusLabel(status: string): string {
  return QUOTE_STATUS_CONFIG[status]?.label || status;
}

/** Helper: get status color for charts */
export function getQuoteStatusColor(status: string): string {
  return QUOTE_STATUS_CONFIG[status]?.color || 'hsl(var(--muted-foreground))';
}

/**
 * Valid status transitions for quotes (SSOT — enforced at service layer).
 * Terminal states (converted, cancelled) have empty arrays: no outgoing transitions.
 *
 * Financially-committed states (approved, converted) are LOCKED to mirror the DB
 * authority public.fn_quotes_enforce_immutability, which — for non-service-role users —
 * permits only approved->converted/expired and converted->expired and rejects anything
 * else with SQLSTATE 23514. The FE intentionally stays a SUBSET (FE ⊆ DB): it must
 * never offer a transition the DB will reject, otherwise the UI exposes an action that
 * errors out (e.g. the Bitrix sync attempting approved->sent). `expired` is automation-
 * driven and is not exposed to humans here. Guarded by quote-status-config.transitions.test.ts.
 */
export const QUOTE_VALID_TRANSITIONS: Readonly<Record<QuoteStatus, readonly QuoteStatus[]>> = {
  draft: ['pending', 'pending_approval', 'sent', 'cancelled'],
  pending_approval: ['draft', 'pending', 'cancelled'],
  pending: ['draft', 'sent', 'expired', 'cancelled'],
  sent: ['approved', 'rejected', 'viewed', 'pending', 'expired', 'cancelled'],
  viewed: ['approved', 'rejected', 'pending', 'expired', 'cancelled'],
  approved: ['converted'], // committed: DB rejects ->sent/->cancelled (see note above)
  converted: [],
  rejected: ['draft', 'sent', 'cancelled'],
  expired: ['draft', 'pending', 'sent', 'cancelled'],
  cancelled: [],
};

/** Returns true if moving from → to is a permitted transition. */
export function isValidQuoteTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  // BUG-016: DB values cast to QuoteStatus may not match any key (e.g. future statuses,
  // migrations). Guard prevents TypeError: cannot read 'includes' of undefined.
  const transitions = QUOTE_VALID_TRANSITIONS[from];
  if (!transitions) return false;
  return (transitions as readonly string[]).includes(to);
}
