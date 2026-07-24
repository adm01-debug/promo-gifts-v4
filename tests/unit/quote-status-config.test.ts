/**
 * Unit tests for src/lib/quote-status-config.ts
 *
 * QUOTE_STATUS_CONFIG, getQuoteStatusLabel, getQuoteStatusColor
 */
import { describe, it, expect } from 'vitest';
import {
  QUOTE_STATUS_CONFIG,
  getQuoteStatusLabel,
  getQuoteStatusColor,
} from '@/lib/quote-status-config';

// ============================================
// QUOTE_STATUS_CONFIG shape
// ============================================

const KNOWN_STATUSES = [
  'draft',
  'pending_approval',
  'pending',
  'sent',
  'approved',
  'converted',
  'viewed',
  'rejected',
  'expired',
  'cancelled',
] as const;

describe('QUOTE_STATUS_CONFIG shape', () => {
  it('defines all 10 expected statuses', () => {
    for (const s of KNOWN_STATUSES) {
      expect(QUOTE_STATUS_CONFIG[s]).toBeDefined();
    }
  });

  it('every entry has a non-empty label', () => {
    for (const s of KNOWN_STATUSES) {
      expect(QUOTE_STATUS_CONFIG[s].label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a color string', () => {
    for (const s of KNOWN_STATUSES) {
      expect(typeof QUOTE_STATUS_CONFIG[s].color).toBe('string');
      expect(QUOTE_STATUS_CONFIG[s].color.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid badgeVariant', () => {
    const validVariants = ['default', 'secondary', 'destructive', 'outline'];
    for (const s of KNOWN_STATUSES) {
      expect(validVariants).toContain(QUOTE_STATUS_CONFIG[s].badgeVariant);
    }
  });

  it('every entry has a non-empty badgeClassName', () => {
    for (const s of KNOWN_STATUSES) {
      expect(QUOTE_STATUS_CONFIG[s].badgeClassName.length).toBeGreaterThan(0);
    }
  });

  it('draft label is "Rascunho"', () => {
    expect(QUOTE_STATUS_CONFIG.draft.label).toBe('Rascunho');
  });

  it('approved label is "Aprovado"', () => {
    expect(QUOTE_STATUS_CONFIG.approved.label).toBe('Aprovado');
  });

  it('rejected badgeVariant is "destructive"', () => {
    expect(QUOTE_STATUS_CONFIG.rejected.badgeVariant).toBe('destructive');
  });

  it('cancelled badgeClassName contains "line-through"', () => {
    expect(QUOTE_STATUS_CONFIG.cancelled.badgeClassName).toContain('line-through');
  });
});

// ============================================
// getQuoteStatusLabel
// ============================================

describe('getQuoteStatusLabel', () => {
  it('returns "Rascunho" for "draft"', () => {
    expect(getQuoteStatusLabel('draft')).toBe('Rascunho');
  });

  it('returns "Aguardando Aprovação" for "pending_approval"', () => {
    expect(getQuoteStatusLabel('pending_approval')).toBe('Aguardando Aprovação');
  });

  it('returns "Pendente" for "pending"', () => {
    expect(getQuoteStatusLabel('pending')).toBe('Pendente');
  });

  it('returns "Enviado" for "sent"', () => {
    expect(getQuoteStatusLabel('sent')).toBe('Enviado');
  });

  it('returns "Aprovado" for "approved"', () => {
    expect(getQuoteStatusLabel('approved')).toBe('Aprovado');
  });

  it('returns "Convertido em Pedido" for "converted"', () => {
    expect(getQuoteStatusLabel('converted')).toBe('Convertido em Pedido');
  });

  it('returns "Visualizado" for "viewed"', () => {
    expect(getQuoteStatusLabel('viewed')).toBe('Visualizado');
  });

  it('returns "Rejeitado" for "rejected"', () => {
    expect(getQuoteStatusLabel('rejected')).toBe('Rejeitado');
  });

  it('returns "Expirado" for "expired"', () => {
    expect(getQuoteStatusLabel('expired')).toBe('Expirado');
  });

  it('returns "Cancelado" for "cancelled"', () => {
    expect(getQuoteStatusLabel('cancelled')).toBe('Cancelado');
  });

  it('falls back to the status string for unknown status', () => {
    expect(getQuoteStatusLabel('unknown_status')).toBe('unknown_status');
    expect(getQuoteStatusLabel('custom-flow')).toBe('custom-flow');
  });

  it('falls back to empty string for empty string input', () => {
    expect(getQuoteStatusLabel('')).toBe('');
  });
});

// ============================================
// getQuoteStatusColor
// ============================================

describe('getQuoteStatusColor', () => {
  it('returns a non-empty string for each known status', () => {
    for (const s of KNOWN_STATUSES) {
      expect(getQuoteStatusColor(s).length).toBeGreaterThan(0);
    }
  });

  it('returns "hsl(..." string for approved', () => {
    expect(getQuoteStatusColor('approved')).toContain('hsl(');
  });

  it('returns muted color for unknown status', () => {
    expect(getQuoteStatusColor('nonexistent')).toBe('hsl(var(--muted-foreground))');
  });

  it('rejected uses destructive color token', () => {
    expect(getQuoteStatusColor('rejected')).toContain('destructive');
  });

  it('pending_approval uses amber-ish color', () => {
    const color = getQuoteStatusColor('pending_approval');
    expect(color).toContain('hsl(');
  });

  it('returns same color for approved and converted', () => {
    expect(getQuoteStatusColor('approved')).toBe(getQuoteStatusColor('converted'));
  });

  it('expired and cancelled both use muted-foreground color', () => {
    const expired = getQuoteStatusColor('expired');
    const cancelled = getQuoteStatusColor('cancelled');
    expect(expired).toBe(cancelled);
    expect(expired).toContain('muted-foreground');
  });
});
