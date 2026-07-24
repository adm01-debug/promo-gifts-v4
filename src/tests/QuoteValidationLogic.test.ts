import { describe, it, expect } from 'vitest';
import { quoteFormSchema, quoteItemSchema } from '../lib/validations/quoteSchema';

describe('Quote Validation Logic Audit', () => {
  it('should require shipping cost when fob_pre is selected', () => {
    const data = {
      clientId: '123',
      contactId: '456',
      paymentMethod: 'Pix',
      paymentTerms: '30 dias',
      deliveryTime: '10 dias',
      shippingType: 'fob_pre',
      shippingCost: 0,
    };

    const result = quoteFormSchema.safeParse(data);
    expect(result.success).toBe(false);

    const issues = !result.success ? result.error.issues : [];
    const shippingError = issues.find((i) => i.path.includes('shippingCost'));
    expect(shippingError?.message).toBe(
      'Valor do frete inconsistente com a modalidade selecionada',
    );
  });

  it('should allow zero shipping cost when CIF is selected', () => {
    const data = {
      clientId: '123',
      contactId: '456',
      paymentMethod: 'Pix',
      paymentTerms: '30 dias',
      deliveryTime: '10 dias',
      shippingType: 'cif',
      shippingCost: 0,
      discountValue: 0,
    };

    const result = quoteFormSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should validate quote items correctly', () => {
    const validItem = {
      product_id: 'prod-1',
      product_name: 'Garrafa',
      quantity: 50,
      unit_price: 15.5,
    };

    expect(quoteItemSchema.safeParse(validItem).success).toBe(true);

    const invalidItem = {
      product_id: '',
      product_name: 'Garrafa',
      quantity: 0, // invalid
      unit_price: -1, // invalid
    };

    const result = quoteItemSchema.safeParse(invalidItem);
    expect(result.success).toBe(false);
  });

  it('should enforce maximum character limits on notes', () => {
    const longNotes = 'a'.repeat(2001);
    const data = {
      clientId: '123',
      contactId: '456',
      paymentMethod: 'Pix',
      paymentTerms: '30 dias',
      deliveryTime: '10 dias',
      shippingType: 'cif',
      shippingCost: 0,
      notes: longNotes,
    };

    const result = quoteFormSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
