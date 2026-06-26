/**
 * Unit tests for getQuoteRowBadge — cobre os 10 status canônicos +
 * 3 derivações de DAR (pending × discount_approval_status).
 */
import { describe, it, expect } from 'vitest';
import { getQuoteRowBadge, QUOTE_BADGE_LEGEND } from '../QuotesStatusChips';
import type { Quote } from '@/hooks/quotes';

const make = (overrides: Partial<Quote>): Quote =>
  ({
    status: 'pending',
    subtotal: 0,
    discount_percent: 0,
    discount_amount: 0,
    total: 0,
    ...overrides,
  }) as Quote;

describe('getQuoteRowBadge', () => {
  it('draft → Rascunho roxo tracejado', () => {
    const b = getQuoteRowBadge(make({ status: 'draft' }));
    expect(b.label).toBe('Rascunho');
    expect(b.className).toContain('purple');
    expect(b.className).toContain('border-dashed');
  });

  it('pending + !synced + sem DAR → Criado (Não Sincronizado) amarelo', () => {
    const b = getQuoteRowBadge(make({ status: 'pending', synced_to_bitrix: false }));
    expect(b.label).toBe('Criado (Não Sincronizado)');
    expect(b.className).toContain('yellow');
  });

  it('pending + null synced → trata como não sincronizado', () => {
    const b = getQuoteRowBadge(make({ status: 'pending', synced_to_bitrix: null as never }));
    expect(b.label).toBe('Criado (Não Sincronizado)');
  });

  it('pending + synced + sem DAR → Criado/Sincronizado primary', () => {
    const b = getQuoteRowBadge(make({ status: 'pending', synced_to_bitrix: true }));
    expect(b.label).toBe('Criado/Sincronizado');
    expect(b.className).toContain('primary');
  });

  it('pending_approval → Aguardando Aprovação laranja', () => {
    const b = getQuoteRowBadge(make({ status: 'pending_approval' }));
    expect(b.label).toBe('Aguardando Aprovação');
    expect(b.className).toContain('orange');
  });

  it('pending + dar=pending → Aguardando Aprovação (DAR vence synced)', () => {
    const b = getQuoteRowBadge(
      make({ status: 'pending', synced_to_bitrix: true, discount_approval_status: 'pending' }),
    );
    expect(b.label).toBe('Aguardando Aprovação');
  });

  it('pending + dar=approved → Desconto Aprovado esmeralda', () => {
    const b = getQuoteRowBadge(
      make({ status: 'pending', discount_approval_status: 'approved' }),
    );
    expect(b.label).toBe('Desconto Aprovado');
    expect(b.className).toContain('emerald');
  });

  it('pending + dar=rejected → Desconto Rejeitado destructive', () => {
    const b = getQuoteRowBadge(
      make({ status: 'pending', discount_approval_status: 'rejected' }),
    );
    expect(b.label).toBe('Desconto Rejeitado');
    expect(b.className).toContain('destructive');
  });

  it('sent → Enviado', () => {
    expect(getQuoteRowBadge(make({ status: 'sent' })).label).toBe('Enviado');
  });

  it('viewed → Visualizado', () => {
    expect(getQuoteRowBadge(make({ status: 'viewed' })).label).toBe('Visualizado');
  });

  it('approved → Aprovado success', () => {
    const b = getQuoteRowBadge(make({ status: 'approved' }));
    expect(b.label).toBe('Aprovado');
    expect(b.className).toContain('success');
  });

  it('converted → Convertido em Pedido', () => {
    expect(getQuoteRowBadge(make({ status: 'converted' })).label).toBe('Convertido em Pedido');
  });

  it('rejected → Rejeitado destructive', () => {
    const b = getQuoteRowBadge(make({ status: 'rejected' }));
    expect(b.label).toBe('Rejeitado');
    expect(b.className).toContain('destructive');
  });

  it('cancelled → Cancelado line-through', () => {
    const b = getQuoteRowBadge(make({ status: 'cancelled' }));
    expect(b.label).toBe('Cancelado');
    expect(b.className).toContain('line-through');
  });

  it('expired → Expirado cinza', () => {
    const b = getQuoteRowBadge(make({ status: 'expired' }));
    expect(b.label).toBe('Expirado');
    expect(b.className).toContain('muted');
  });

  it('todos os 10 status canônicos retornam um badge não-vazio', () => {
    const statuses = [
      'draft',
      'pending',
      'pending_approval',
      'sent',
      'viewed',
      'approved',
      'converted',
      'rejected',
      'expired',
      'cancelled',
    ] as const;
    for (const s of statuses) {
      const b = getQuoteRowBadge(make({ status: s }));
      expect(b.label.length).toBeGreaterThan(0);
      expect(b.className.length).toBeGreaterThan(0);
    }
  });
});

describe('QUOTE_BADGE_LEGEND', () => {
  it('contém entradas para os 14 estados visuais (inclui expired_discount)', () => {
    expect(QUOTE_BADGE_LEGEND).toHaveLength(14);
  });

  it('toda entrada tem label, className e description não-vazios', () => {
    for (const item of QUOTE_BADGE_LEGEND) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.className.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });
});
