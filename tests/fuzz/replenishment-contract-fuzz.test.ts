import { test, expect } from 'vitest';
import { ProductWebhookSchemas } from '../../../supabase/functions/_shared/contracts/schemas/product-webhook.ts';

test.describe('Reposição - Fuzzing e Validação de Contrato', () => {
  
  test('Deve rejeitar payloads com tipos inválidos em campos numéricos', () => {
    const invalidPayload = {
      action: 'upsert',
      product: {
        sku: 'TEST-SKU',
        name: 'Product',
        price: 'not-a-number', // Erro proposital
        stock: 10
      }
    };
    
    const result = ProductWebhookSchemas.versions['1'].safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  test('Deve rejeitar payloads com campos obrigatórios ausentes na V2', () => {
    const invalidV2 = {
      action: 'upsert',
      // idempotency_key ausente
      product: {
        external_id: 'ext-123',
        sku: 'SKU-V2',
        name: 'V2 Product'
      }
    };
    
    const result = ProductWebhookSchemas.versions['2'].safeParse(invalidV2);
    expect(result.success).toBe(false);
  });

  test('Fuzzing: Deve lidar com strings extremamente longas nos nomes', () => {
    const longNamePayload = {
      action: 'upsert',
      product: {
        sku: 'SKU-LONG',
        name: 'A'.repeat(5000), // Nome gigante
        price: 10.0,
        stock: 5
      }
    };
    
    const result = ProductWebhookSchemas.versions['1'].safeParse(longNamePayload);
    // O Zod deve validar o tamanho se houver restrição, ou aceitar se o esquema permitir
    expect(result.success).toBe(true); 
  });
});
