import { describe, it, expect } from 'vitest';
import { loginSchema, signupSchema } from '../lib/validations/authSchema';
import { quoteFormSchema } from '../lib/validations/quoteSchema';

describe('Real-World Scenario: Security & Validation Layer', () => {
  it('Scenario 1: User Login Attempt with Malformed Data', () => {
    const invalidData = { email: 'not-an-email', password: 'short' };
    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('Scenario 2: Complex Quote Creation with Shipping Logistics', () => {
    // Schema real (src/lib/validations/quoteSchema.ts):
    //  - fob_pre  → REQUER shippingCost > 0
    //  - qualquer outro tipo (cif, fob plain, …) → shippingCost DEVE ser 0
    const validCIF = {
      clientId: 'c-1',
      contactId: 'ct-1',
      paymentMethod: 'pix',
      paymentTerms: 'net30',
      deliveryTime: '10days',
      shippingType: 'cif',
      discountValue: 0,
    };
    expect(quoteFormSchema.safeParse(validCIF).success).toBe(true);

    // fob_pre com shippingCost: 0 → viola refine (fob_pre exige > 0)
    const invalidFobPre = {
      clientId: 'c-1',
      contactId: 'ct-1',
      paymentMethod: 'pix',
      paymentTerms: 'net30',
      deliveryTime: '10days',
      shippingType: 'fob_pre',
      shippingCost: 0,
    };
    expect(quoteFormSchema.safeParse(invalidFobPre).success).toBe(false);

    // cif com shippingCost > 0 → viola refine (não-fob_pre exige === 0)
    const invalidCifWithCost = {
      clientId: 'c-1',
      contactId: 'ct-1',
      paymentMethod: 'pix',
      paymentTerms: 'net30',
      deliveryTime: '10days',
      shippingType: 'cif',
      shippingCost: 100,
    };
    expect(quoteFormSchema.safeParse(invalidCifWithCost).success).toBe(false);
  });
});
