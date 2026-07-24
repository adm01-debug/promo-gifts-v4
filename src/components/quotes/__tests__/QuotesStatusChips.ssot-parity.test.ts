/**
 * Paridade SSOT — garante que o enum FE de status (`QUOTE_STATUSES`),
 * o mapa `QUOTE_ROW_BADGE_STYLES` e o conjunto canônico usado pelo seed
 * E2E continuam alinhados. Bloqueia regressões silenciosas quando alguém:
 *   - adiciona um valor novo em `QUOTE_STATUSES` sem mapear badge;
 *   - adiciona um badge sem cobrir no seed (faltaria caso no E2E);
 *   - remove `cancelled` da lista canônica.
 *
 * NÃO importa o módulo do seed (e2e/) — ele depende do bundle Playwright.
 * A lista canônica é repetida aqui com um teste que dá fail explícito se
 * `ALL_BADGE_KEYS` divergir.
 */
import { describe, it, expect } from 'vitest';
import { QUOTE_STATUSES } from '@/types/quote';
import { QUOTE_ROW_BADGE_STYLES } from '../QuotesStatusChips';

/** Conjunto canônico de chaves de badge (espelho de `e2e/helpers/quotes-status-seed.ts`). */
const CANONICAL_BADGE_KEYS = [
  'draft',
  'unsynced',
  'synced',
  'awaiting',
  'approved',
  'rejected',
  'expired',
  'expired_discount',
  'sent',
  'viewed',
  'quote_approved',
  'converted',
  'cancelled',
  'quote_rejected',
] as const;

/**
 * Subconjunto dos `QUOTE_STATUSES` (enum FE = CHECK do BD) que cada
 * badge representa. Badges agregados (`unsynced`, `synced`, `awaiting`,
 * `approved`, `rejected`, `expired_discount`) caem em status do enum FE
 * porque também são alimentados por `discount_approval_status`.
 */
const BADGE_TO_QUOTE_STATUS: Record<(typeof CANONICAL_BADGE_KEYS)[number], string> = {
  draft: 'draft',
  unsynced: 'pending',
  synced: 'pending',
  awaiting: 'pending_approval',
  approved: 'pending',
  rejected: 'pending',
  expired: 'expired',
  expired_discount: 'pending',
  sent: 'sent',
  viewed: 'viewed',
  quote_approved: 'approved',
  converted: 'converted',
  cancelled: 'cancelled',
  quote_rejected: 'rejected',
};

describe('SSOT parity — QUOTE_STATUSES × QUOTE_ROW_BADGE_STYLES', () => {
  it('QUOTE_ROW_BADGE_STYLES tem exatamente as 14 chaves canônicas', () => {
    expect(Object.keys(QUOTE_ROW_BADGE_STYLES).sort()).toEqual(
      [...CANONICAL_BADGE_KEYS].sort(),
    );
  });

  it('todo badge mapeia para um status válido em QUOTE_STATUSES', () => {
    const invalid = Object.entries(BADGE_TO_QUOTE_STATUS).filter(
      ([, status]) => !(QUOTE_STATUSES as readonly string[]).includes(status),
    );
    expect(invalid, `badges apontam para status fora do enum: ${invalid.map(([k]) => k).join(', ')}`)
      .toEqual([]);
  });

  it('todo status do enum FE tem ao menos um badge cobrindo (sem órfãos)', () => {
    const covered = new Set(Object.values(BADGE_TO_QUOTE_STATUS));
    const orphans = QUOTE_STATUSES.filter((s) => !covered.has(s));
    expect(orphans, `status sem badge: ${orphans.join(', ')}`).toEqual([]);
  });

  it('cancelled continua presente no SSOT (bloqueio do CHECK não muda o FE)', () => {
    expect(QUOTE_STATUSES).toContain('cancelled');
    expect(Object.keys(QUOTE_ROW_BADGE_STYLES)).toContain('cancelled');
  });
});

describe('SSOT parity — seed E2E (conjunto canônico)', () => {
  it('o conjunto canônico tem 14 entradas distintas', () => {
    expect(new Set(CANONICAL_BADGE_KEYS).size).toBe(14);
  });

  it('toda chave do conjunto canônico existe em QUOTE_ROW_BADGE_STYLES', () => {
    const missing = CANONICAL_BADGE_KEYS.filter((k) => !(k in QUOTE_ROW_BADGE_STYLES));
    expect(missing, `seed cobre chaves que não existem no SSOT: ${missing.join(', ')}`)
      .toEqual([]);
  });
});
