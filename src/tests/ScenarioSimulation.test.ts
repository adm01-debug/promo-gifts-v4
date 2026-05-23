import { describe, it, expect } from 'vitest';
import { loginSchema } from '../lib/validations/authSchema';
import { quoteFormSchema } from '../lib/validations/quoteSchema';

describe('Real-World Scenario: Security & Validation Layer', () => {
  it('Scenario 1: User Login Attempt with Malformed Data', () => {
    const invalidData = { email: 'not-an-email', password: 'short' };
    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('Scenario 2: Complex Quote Creation with Shipping Logistics', () => {
    // Testing the logic: FOB requires shippingCost, CIF does not
    const validCIF = {
      clientId: 'c-1',
      contactId: 'ct-1',
      paymentMethod: 'pix',
      paymentTerms: 'net30',
      deliveryTime: '10days',
      shippingType: 'cif', // != fob_pre => shippingCost default 0 é consistente
      discountValue: 0
    };
    expect(quoteFormSchema.safeParse(validCIF).success).toBe(true);

    const invalidFOB = {
      clientId: 'c-1',
      contactId: 'ct-1',
      paymentMethod: 'pix',
      paymentTerms: 'net30',
      deliveryTime: '10days',
      shippingType: 'fob_pre',
      shippingCost: 0 // fob_pre exige shippingCost > 0 => deve falhar no refine
    };
    const fobResult = quoteFormSchema.safeParse(invalidFOB);
    expect(fobResult.success).toBe(false);
  });
});
