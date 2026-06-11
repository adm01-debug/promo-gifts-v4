import { describe, it, expect, vi } from 'vitest';
import { ProductWebhookV1, ProductWebhookV2 } from '../../supabase/functions/_shared/contracts/schemas/product-webhook';

describe('Compatibilidade de Schemas - Reposição', () => {
  it('Deve validar que o Schema V1 continua aceitando payloads Legados (Backwards Compatibility)', () => {
    const legacyPayload = {
      action: 'sync',
      product: {
        sku: 'TEST-001',
        name: 'Produto Teste',
        price: 100.0,
        stock: 10
      }
    };

    const result = ProductWebhookV1.safeParse(legacyPayload);
    expect(result.success).toBe(true);
  });

  it('Deve validar que o Schema V2 exige Idempotency Key e External ID', () => {
    const invalidV2 = {
      action: 'upsert',
      product: {
        sku: 'TEST-V2',
        name: 'V2 Test',
        price: 50
      }
      // Faltando idempotency_key e external_id
    };

    const result = ProductWebhookV2.safeParse(invalidV2);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(i => i.path.join('.'));
      expect(paths).toContain('idempotency_key');
      expect(paths).toContain('product.external_id');
    }
  });

  it('Zod Contract: Mudanças no banco não devem quebrar validação de campos críticos', () => {
    // Este teste garante que campos usados no hook useReplenishments.ts 
    // estão mapeados nos contratos das Edge Functions.
    const criticalFields = ['sku', 'price', 'name'];
    const schemaFields = Object.keys(ProductWebhookV1.shape.product.unwrap().shape);
    
    criticalFields.forEach(field => {
      expect(schemaFields).toContain(field);
    });
  });
});
