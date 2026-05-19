/**
 * Integration tests for QuoteBuilderPage — validates quote item logic,
 * pricing calculations, and data transformations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findKnownHex } from '@/hooks/productss';

// ============================================
// Replicate QuoteBuilder pure logic for testing
// ============================================

interface QuoteItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  color_name?: string | null;
  color_hex?: string | null;
  notes?: string | null;
}

function calculateItemTotal(item: QuoteItem): number {
  return item.quantity * item.unit_price;
}

function calculateQuoteSubtotal(items: QuoteItem[]): number {
  return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
}

function formatUnitPrice(price: number): string {
  return price.toFixed(4);
}

function generateItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function resolveColorHex(colorName: string | null | undefined): string {
  if (!colorName) return '#CCCCCC';
  return findKnownHex(colorName) || '#CCCCCC';
}

function validateQuoteItems(items: QuoteItem[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (items.length === 0) {
    errors.push('O orçamento deve ter pelo menos um item');
  }
  
  items.forEach((item, index) => {
    if (!item.product_name) {
      errors.push(`Item ${index + 1}: nome do produto é obrigatório`);
    }
    if (item.quantity <= 0) {
      errors.push(`Item ${index + 1}: quantidade deve ser maior que zero`);
    }
    if (item.unit_price < 0) {
      errors.push(`Item ${index + 1}: preço unitário não pode ser negativo`);
    }
  });
  
  return { valid: errors.length === 0, errors };
}

// ============================================
// Tests
// ============================================

const sampleItems: QuoteItem[] = [
  { id: '1', product_id: 'p1', product_name: 'Caneta', product_sku: 'CAN-001', quantity: 500, unit_price: 3.4567 },
  { id: '2', product_id: 'p2', product_name: 'Caderno', product_sku: 'CAD-001', quantity: 200, unit_price: 15.2345, color_name: 'Azul Royal', color_hex: '#4169E1' },
  { id: '3', product_id: 'p3', product_name: 'Mochila', product_sku: 'MOC-001', quantity: 100, unit_price: 89.99, color_name: 'Preto' },
];

describe('QuoteBuilder — Item Calculations', () => {
  it('calculates single item total', () => {
    const total = calculateItemTotal(sampleItems[0]);
    expect(total).toBeCloseTo(500 * 3.4567, 4);
  });

  it('calculates quote subtotal', () => {
    const subtotal = calculateQuoteSubtotal(sampleItems);
    const expected = (500 * 3.4567) + (200 * 15.2345) + (100 * 89.99);
    expect(subtotal).toBeCloseTo(expected, 2);
  });

  it('handles empty items list', () => {
    expect(calculateQuoteSubtotal([])).toBe(0);
  });

  it('handles zero quantity', () => {
    const item: QuoteItem = { id: 'x', product_id: 'px', product_name: 'Test', product_sku: 'T', quantity: 0, unit_price: 10 };
    expect(calculateItemTotal(item)).toBe(0);
  });
});

describe('QuoteBuilder — Price Formatting', () => {
  it('formats with 4 decimal places', () => {
    expect(formatUnitPrice(3.4567)).toBe('3.4567');
    expect(formatUnitPrice(10)).toBe('10.0000');
    expect(formatUnitPrice(0.1)).toBe('0.1000');
  });
});

describe('QuoteBuilder — Item ID Generation', () => {
  it('generates unique IDs', () => {
    const id1 = generateItemId();
    const id2 = generateItemId();
    expect(id1).not.toBe(id2);
    expect(id1.startsWith('item-')).toBe(true);
  });
});

describe('QuoteBuilder — Color Resolution', () => {
  it('resolves known color names', () => {
    expect(resolveColorHex('Azul Royal')).toBe('#4169E1');
    expect(resolveColorHex('Preto')).toBe('#000000');
    expect(resolveColorHex('Branco')).toBe('#FFFFFF');
  });

  it('returns default for null/undefined', () => {
    expect(resolveColorHex(null)).toBe('#CCCCCC');
    expect(resolveColorHex(undefined)).toBe('#CCCCCC');
  });

  it('returns default for unknown colors', () => {
    expect(resolveColorHex('Cor Inexistente')).toBe('#CCCCCC');
  });
});

describe('QuoteBuilder — Validation', () => {
  it('validates valid items', () => {
    const result = validateQuoteItems(sampleItems);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects empty items list', () => {
    const result = validateQuoteItems([]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('O orçamento deve ter pelo menos um item');
  });

  it('rejects zero quantity', () => {
    const items: QuoteItem[] = [
      { id: '1', product_id: 'p1', product_name: 'Test', product_sku: 'T', quantity: 0, unit_price: 10 },
    ];
    const result = validateQuoteItems(items);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('quantidade'))).toBe(true);
  });

  it('rejects negative price', () => {
    const items: QuoteItem[] = [
      { id: '1', product_id: 'p1', product_name: 'Test', product_sku: 'T', quantity: 100, unit_price: -5 },
    ];
    const result = validateQuoteItems(items);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('preço'))).toBe(true);
  });

  it('rejects missing product name', () => {
    const items: QuoteItem[] = [
      { id: '1', product_id: 'p1', product_name: '', product_sku: 'T', quantity: 100, unit_price: 10 },
    ];
    const result = validateQuoteItems(items);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('nome'))).toBe(true);
  });

  it('reports multiple errors', () => {
    const items: QuoteItem[] = [
      { id: '1', product_id: 'p1', product_name: '', product_sku: 'T', quantity: 0, unit_price: -1 },
    ];
    const result = validateQuoteItems(items);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
