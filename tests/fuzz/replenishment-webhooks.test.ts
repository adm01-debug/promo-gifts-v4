import { describe, it, expect } from 'vitest';
import { parseContract } from '../../supabase/functions/_shared/contracts/parse';
import { WebhookInboundSchemas } from '../../supabase/functions/_shared/contracts/schemas/webhook-inbound';
import { makeRequest } from '../contracts/_helpers';

describe('Fuzz Testing: Webhook Inbound (Replenishment)', () => {
  const generateFuzzPayloads = () => {
    return [
      { action: 'sync', table: 'A'.repeat(200) }, // Table name too long
      { action: 'invalid_action', table: 'products' }, // Invalid enum
      { action: 'sync', table: 123 }, // Wrong type
      { action: 'sync', table: 'products', since: 'not-a-date' }, // Invalid string
      { action: 'sync' }, // Missing required table
      { table: 'products' }, // Missing action
      {}, // Empty
      null,
      "not a json",
      { action: 'sync', table: 'products', nested: { payload: "too deep".repeat(1000) } } // Payload depth/size
    ];
  };

  it('Deve tratar payloads malformados sem crashar o parser', async () => {
    const payloads = generateFuzzPayloads();
    
    for (const payload of payloads) {
      const req = makeRequest({ body: payload });
      const r = await parseContract(req, WebhookInboundSchemas);
      
      // O parser deve retornar ok: false, nunca lançar exceção
      expect(r.ok).toBe(false);
      expect(r.response.status).toBeGreaterThanOrEqual(400);
      
      const body = await r.response.json();
      expect(body).toHaveProperty('code');
      expect(['validation_failed', 'invalid_json', 'missing_body']).toContain(body.code);
    }
  });

  it('Deve resistir a campos com caracteres especiais e injeção básica', async () => {
    const injectionPayloads = [
      { action: 'sync', table: "products'; DROP TABLE users;--" },
      { action: 'sync', table: "<script>alert(1)</script>" },
      { action: 'sync', table: "../../../etc/passwd" }
    ];

    for (const payload of injectionPayloads) {
      const req = makeRequest({ body: payload });
      const r = await parseContract(req, WebhookInboundSchemas);
      
      // No nível de contrato, isso pode ser "válido" se for apenas string, 
      // mas validamos que o sistema de tipos (zod) aplica os limites.
      // Se passar no contrato, a camada de DB/Serviço deve sanitizar.
      // Aqui apenas garantimos que o parser não explode.
      if (!r.ok) {
        expect(r.response.status).toBe(422);
      }
    }
  });
});
