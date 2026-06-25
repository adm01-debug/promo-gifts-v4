import { describe, it, expect } from 'vitest';
import {
  getDiscountValidationMessage,
  getApprovalChecklist,
  isApprovalReady,
  MIN_SELLER_NOTES_LENGTH,
} from '../discount-validation-messages';

describe('getDiscountValidationMessage', () => {
  const baseLimit = 10;

  it('reporta "valor inválido" quando vendedor digita 1000', () => {
    const msg = getDiscountValidationMessage({
      rawPercent: 1000,
      realDiscountPercent: 1000,
      maxDiscountPercent: baseLimit,
      hasMarkup: false,
    });
    expect(msg.kind).toBe('invalid_over_100');
    expect(msg.severity).toBe('error');
    expect(msg.description).toContain('100%');
    expect(msg.description).toContain('1.000%');
    expect(msg.callToAction).toContain('0%');
  });

  it('reporta inválido em valor negativo', () => {
    const msg = getDiscountValidationMessage({
      rawPercent: -5,
      realDiscountPercent: -5,
      maxDiscountPercent: baseLimit,
      hasMarkup: false,
    });
    expect(msg.kind).toBe('invalid_negative');
  });

  it('reporta inválido em NaN/Infinity', () => {
    const m1 = getDiscountValidationMessage({
      rawPercent: NaN,
      realDiscountPercent: 0,
      maxDiscountPercent: baseLimit,
      hasMarkup: false,
    });
    const m2 = getDiscountValidationMessage({
      rawPercent: Infinity,
      realDiscountPercent: 0,
      maxDiscountPercent: baseLimit,
      hasMarkup: false,
    });
    expect(m1.severity).toBe('error');
    expect(m2.severity).toBe('error');
  });

  it('dispara fluxo de alçada quando realDiscountPercent > maxDiscountPercent (sem margem)', () => {
    const msg = getDiscountValidationMessage({
      rawPercent: 30,
      realDiscountPercent: 30,
      maxDiscountPercent: 10,
      hasMarkup: false,
    });
    expect(msg.kind).toBe('exceeds_limit');
    expect(msg.severity).toBe('warning');
    expect(msg.callToAction).toMatch(/Solicitar Aprovação/);
    expect(msg.description).toContain('30%');
    expect(msg.description).toContain('10%');
  });

  it('exibe que a margem já foi considerada no desconto real (com markup)', () => {
    const msg = getDiscountValidationMessage({
      rawPercent: 30,
      realDiscountPercent: 16,
      maxDiscountPercent: 10,
      hasMarkup: true,
      markupPercent: 20,
    });
    expect(msg.kind).toBe('exceeds_limit');
    expect(msg.description).toContain('Margem de Negociação');
    expect(msg.description).toContain('20%');
  });

  it('NÃO dispara alçada quando markup forte zera/inverte o desconto real', () => {
    const msg = getDiscountValidationMessage({
      rawPercent: 30,
      realDiscountPercent: -4,
      maxDiscountPercent: 10,
      hasMarkup: true,
      markupPercent: 50,
    });
    expect(msg.kind).toBe('within_limit');
    expect(msg.severity).toBe('success');
  });

  it('mostra dica de Margem quando real está perto do limite (>70% do teto)', () => {
    const msg = getDiscountValidationMessage({
      rawPercent: 9,
      realDiscountPercent: 9,
      maxDiscountPercent: 10,
      hasMarkup: false,
    });
    expect(msg.kind).toBe('markup_hint');
    expect(msg.callToAction).toContain('Margem de Negociação');
  });

  it('estado idle quando não há desconto', () => {
    const msg = getDiscountValidationMessage({
      rawPercent: 0,
      realDiscountPercent: 0,
      maxDiscountPercent: 10,
      hasMarkup: false,
    });
    expect(msg.kind).toBe('idle');
  });
});

describe('approval checklist', () => {
  it('lista os 3 critérios e marca cada um corretamente', () => {
    const checklist = getApprovalChecklist({
      hasItems: true,
      hasClient: false,
      sellerNotesLength: 5,
    });
    expect(checklist).toHaveLength(3);
    expect(checklist.find((c) => c.key === 'items')?.ok).toBe(true);
    expect(checklist.find((c) => c.key === 'client')?.ok).toBe(false);
    expect(checklist.find((c) => c.key === 'notes')?.ok).toBe(false);
  });

  it('isApprovalReady=true só quando os 3 critérios passam', () => {
    expect(
      isApprovalReady({ hasItems: true, hasClient: true, sellerNotesLength: MIN_SELLER_NOTES_LENGTH }),
    ).toBe(true);
    expect(
      isApprovalReady({ hasItems: true, hasClient: true, sellerNotesLength: MIN_SELLER_NOTES_LENGTH - 1 }),
    ).toBe(false);
  });
});
