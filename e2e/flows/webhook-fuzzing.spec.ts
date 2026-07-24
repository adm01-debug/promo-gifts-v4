import { test, expect } from '@playwright/test';

/**
 * Testes de Fuzzing e Payloads Malformados para Webhooks
 * Valida a resiliência do sistema contra dados inválidos.
 */
test.describe('Webhook Fuzzing & Validation @fuzz @security', () => {
  const baseUrl = process.env.VITE_SUPABASE_URL || 'https://example.supabase.co';
  const webhookUrl = `${baseUrl}/functions/v1/webhook-inbound`;

  const payloads = [
    { label: 'Payload vazio', body: {} },
    { label: 'JSON malformado', body: "{ invalid: 'json' ", isRaw: true },
    { label: 'UUID inválido', body: { event: 'quote.approved', data: { quote_id: '123-not-a-uuid' } } },
    { label: 'Campos obrigatórios ausentes', body: { source: 'n8n' } },
    { label: 'Payload gigante', body: { event: 'test', data: 'A'.repeat(100000) } },
    { label: 'Tipos de dados incorretos', body: { event: 12345, data: { amount: 'muito-caro' } } },
    { label: 'Tentativa de Injeção SQL', body: { event: 'quote.approved', data: { quote_id: "'; DROP TABLE quotes; --" } } }
  ];

  for (const scenario of payloads) {
    test(`Valida cenário: ${scenario.label}`, async ({ request }) => {
      const response = await request.post(webhookUrl, {
        data: scenario.isRaw ? scenario.body : JSON.stringify(scenario.body),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || 'fake-key'}`
        }
      });

      // O sistema deve rejeitar (400) ou lidar graciosamente (200 mas sem crash)
      // Nunca deve retornar 500 (Internal Server Error)
      expect(response.status()).toBeLessThan(500);
      
      if (scenario.label === 'JSON malformado' || scenario.label === 'Campos obrigatórios ausentes') {
        expect(response.status()).toBe(400);
      }
    });
  }
});
