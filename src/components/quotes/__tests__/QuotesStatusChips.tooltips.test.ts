/**
 * SSOT dos tooltips de status: garante que toda chave de chip tem copy
 * mapeada, toda chave de badge tem `description` não vazia e que a chave
 * `awaiting` continua espelhada em `pending_approval` (chip). Bloqueia
 * regressões silenciosas quando alguém adicionar status novo no enum
 * sem atualizar o mapa compartilhado.
 */
import { describe, it, expect } from 'vitest';
import {
  CHIP_TOOLTIPS,
  QUOTE_CHIP_MATCHERS,
  QUOTE_ROW_BADGE_STYLES,
  TOOLTIP_FALLBACK_COPY,
  getChipTooltip,
} from '../QuotesStatusChips';

describe('QuotesStatusChips — SSOT de tooltips', () => {
  it('todo chip definido em QUOTE_CHIP_MATCHERS tem tooltip em CHIP_TOOLTIPS', () => {
    const missing = Object.keys(QUOTE_CHIP_MATCHERS).filter(
      (key) => !CHIP_TOOLTIPS[key],
    );
    expect(missing, `chips sem tooltip: ${missing.join(', ')}`).toEqual([]);
  });

  it('toda entry de CHIP_TOOLTIPS corresponde a um chip real (sem órfãos)', () => {
    const orphans = Object.keys(CHIP_TOOLTIPS).filter(
      (key) => !(key in QUOTE_CHIP_MATCHERS),
    );
    expect(orphans, `tooltips órfãos: ${orphans.join(', ')}`).toEqual([]);
  });

  it('toda chave de QUOTE_ROW_BADGE_STYLES tem description não vazia', () => {
    const empties = Object.entries(QUOTE_ROW_BADGE_STYLES)
      .filter(([, v]) => !v.description?.trim())
      .map(([k]) => k);
    expect(empties, `badges sem description: ${empties.join(', ')}`).toEqual([]);
  });

  it('cobre exatamente os 14 status canônicos esperados', () => {
    const expected = [
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
    ].sort();
    expect(Object.keys(QUOTE_ROW_BADGE_STYLES).sort()).toEqual(expected);
  });

  it('nenhuma description é técnica (sem DAR, synced_to_bitrix, pending, alçada=)', () => {
    const technicalTerms = /(\bDAR\b(?!-)|synced_to_bitrix|alçada=|=pending|=approved|=rejected|=expired)/;
    const leaks = Object.entries(QUOTE_ROW_BADGE_STYLES)
      .filter(([, v]) => technicalTerms.test(v.description))
      .map(([k]) => k);
    expect(leaks, `descrições técnicas vazaram em: ${leaks.join(', ')}`).toEqual([]);
  });

  it('chips de desconto reusam a description do badge correspondente (sem divergir)', () => {
    expect(CHIP_TOOLTIPS.pending_approval).toBe(QUOTE_ROW_BADGE_STYLES.awaiting.description);
    expect(CHIP_TOOLTIPS.discount_approved).toBe(QUOTE_ROW_BADGE_STYLES.approved.description);
    expect(CHIP_TOOLTIPS.discount_rejected).toBe(QUOTE_ROW_BADGE_STYLES.rejected.description);
    expect(CHIP_TOOLTIPS.discount_expired).toBe(
      QUOTE_ROW_BADGE_STYLES.expired_discount.description,
    );
    expect(CHIP_TOOLTIPS.created_synced).toBe(QUOTE_ROW_BADGE_STYLES.synced.description);
  });

  describe('getChipTooltip — fallback testável', () => {
    it('retorna a copy mapeada quando a chave existe', () => {
      expect(getChipTooltip('all')).toBe(CHIP_TOOLTIPS.all);
      expect(getChipTooltip('draft')).toBe(QUOTE_ROW_BADGE_STYLES.draft.description);
    });

    it('retorna TOOLTIP_FALLBACK_COPY para chave desconhecida', () => {
      expect(getChipTooltip('chave_inexistente_xyz')).toBe(TOOLTIP_FALLBACK_COPY);
    });

    it('retorna TOOLTIP_FALLBACK_COPY para string vazia', () => {
      expect(getChipTooltip('')).toBe(TOOLTIP_FALLBACK_COPY);
    });
  });
});
