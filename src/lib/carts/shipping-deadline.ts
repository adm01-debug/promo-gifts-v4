/**
 * shipping-deadline — utilitários para o campo `shipping_deadline` do carrinho.
 *
 * Regras (SSOT):
 *  - `overdue`  → data < hoje (à meia-noite local)
 *  - `soon`     → hoje ≤ data ≤ hoje + SOON_THRESHOLD_DAYS
 *  - `ok`       → data > hoje + SOON_THRESHOLD_DAYS
 *  - `none`     → sem data definida
 */
import { z } from 'zod';

export const SOON_THRESHOLD_DAYS = 3;

/** Regex ISO-date estrita (YYYY-MM-DD). */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Schema Zod: aceita `null` (limpar prazo) ou uma data ISO válida (não no passado).
 * Retorna string ISO ou null. Usado no formulário e antes de persistir.
 */
export const shippingDeadlineSchema = z
  .union([z.string().trim(), z.null()])
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || ISO_DATE_RE.test(v), {
    message: 'Data inválida. Use o formato dd/mm/aaaa.',
  })
  .refine(
    (v) => {
      if (v === null) return true;
      const d = new Date(`${v}T00:00:00`);
      return !Number.isNaN(d.getTime());
    },
    { message: 'Data inválida.' },
  )
  .refine(
    (v) => {
      if (v === null) return true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = new Date(`${v}T00:00:00`);
      return d.getTime() >= today.getTime();
    },
    { message: 'A data não pode estar no passado.' },
  );

export type ShippingDeadlineStatus = 'none' | 'ok' | 'overdue' | 'soon';

/** Diferença em dias inteiros (deadline − hoje). Negativo = vencido. */
export function daysUntilDeadline(deadline: string | null | undefined): number | null {
  if (!deadline || !ISO_DATE_RE.test(deadline)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((d.getTime() - today.getTime()) / MS_PER_DAY);
}

export function getShippingDeadlineStatus(
  deadline: string | null | undefined,
  thresholdDays = SOON_THRESHOLD_DAYS,
): ShippingDeadlineStatus {
  const diff = daysUntilDeadline(deadline);
  if (diff === null) return 'none';
  if (diff < 0) return 'overdue';
  if (diff <= thresholdDays) return 'soon';
  return 'ok';
}

/**
 * Classes Tailwind (tokens semânticos) por status — SSOT visual.
 *
 * A11y de contraste (WCAG AA): opacidade de background bumped p/ >=0.20 e
 * cores de texto usando shade escuro no light-mode + shade claro no dark
 * — garante 4.5:1 mínimo em texto pequeno nos dois temas.
 */
export const DEADLINE_BADGE_CLASSES: Record<ShippingDeadlineStatus, string> = {
  overdue:
    'border-destructive/60 bg-destructive/20 text-destructive font-semibold [--chip-glow:var(--destructive)]',
  soon:
    'border-yellow-500/60 bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 font-semibold [--chip-glow:theme(colors.yellow.500)]',
  ok: 'border-border/40 bg-muted/40 text-foreground',
  none: 'border-border/30 bg-muted/20 text-muted-foreground',
};

export function getDeadlineLabel(status: ShippingDeadlineStatus, diffDays: number | null): string {
  if (status === 'none' || diffDays === null) return '—';
  if (status === 'overdue') {
    const d = Math.abs(diffDays);
    return d === 0 ? 'Vence hoje' : `Vencido há ${d} ${d === 1 ? 'dia' : 'dias'}`;
  }
  if (status === 'soon') {
    if (diffDays === 0) return 'Vence hoje';
    return `Faltam ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
  }
  return `Em ${diffDays} dias`;
}

/** Filtros predefinidos para a lista de carrinhos. */
export type DeadlineFilter = 'all' | 'month' | 'none' | 'overdue' | 'soon' | 'week';

export function matchesDeadlineFilter(
  deadline: string | null | undefined,
  filter: DeadlineFilter,
): boolean {
  if (filter === 'all') return true;
  const diff = daysUntilDeadline(deadline);
  if (filter === 'none') return diff === null;
  if (diff === null) return false;
  switch (filter) {
    case 'overdue':
      return diff < 0;
    case 'soon':
      return diff >= 0 && diff <= SOON_THRESHOLD_DAYS;
    case 'week':
      return diff >= 0 && diff <= 7;
    case 'month':
      return diff >= 0 && diff <= 30;
    default:
      return true;
  }
}
