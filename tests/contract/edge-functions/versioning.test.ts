/**
 * Testa o mecanismo de versionamento (resolveContractVersion) e a coexistência
 * v1↔v2 do product-webhook. Inclui:
 *   - default → primeira chave do registry
 *   - header X-Contract-Version e query ?v= (case-insensitive)
 *   - versão deprecated → headers Deprecation/Sunset
 *   - versão desconhecida → 400 UNSUPPORTED_VERSION
 *   - backwards-compat: payload v1 com header v1 continua válido enquanto v2
 *     existir como versão `stable`.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveContractVersion,
  readRequestedVersion,
} from '../../../supabase/functions/_shared/contracts/versioning.ts';
import { contracts as productWebhookContracts } from '../../../supabase/functions/_shared/contracts/product-webhook.contracts.ts';
import { ERROR_CODES } from '../../../supabase/functions/_shared/contracts/error-response.ts';

const cors = { 'Access-Control-Allow-Origin': '*' };

function makeReq(headers: Record<string, string> = {}, queryString = ''): Request {
  return new Request(`https://example.com/fn${queryString}`, {
    method: 'POST',
    headers,
    body: '{}',
  });
}

describe('readRequestedVersion', () => {
  it('lê header X-Contract-Version (case-insensitive)', () => {
    expect(readRequestedVersion(makeReq({ 'X-Contract-Version': 'V2' }))).toBe('v2');
    expect(readRequestedVersion(makeReq({ 'x-contract-version': 'v1' }))).toBe('v1');
  });

  it('fallback para query string ?v=', () => {
    expect(readRequestedVersion(makeReq({}, '?v=v2'))).toBe('v2');
  });

  it('retorna null se nem header nem query', () => {
    expect(readRequestedVersion(makeReq())).toBeNull();
  });

  it('prioriza header sobre query', () => {
    expect(
      readRequestedVersion(makeReq({ 'X-Contract-Version': 'v1' }, '?v=v2')),
    ).toBe('v1');
  });
});

describe('resolveContractVersion', () => {
  it('default → primeira chave do registry (v1) quando nada solicitado', () => {
    const r = resolveContractVersion(makeReq(), productWebhookContracts, cors);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.version).toBe('v1');
  });

  it('versão deprecated propaga headers Deprecation + Sunset', () => {
    const r = resolveContractVersion(makeReq(), productWebhookContracts, cors);
    if (!r.ok) throw new Error('expected ok');
    expect(r.result.responseHeaders['X-Contract-Version']).toBe('v1');
    expect(r.result.responseHeaders['Deprecation']).toBe('true');
    expect(r.result.responseHeaders['Sunset']).toBe('2026-08-22');
  });

  it('versão stable não inclui headers de deprecation', () => {
    const r = resolveContractVersion(
      makeReq({ 'X-Contract-Version': 'v2' }),
      productWebhookContracts,
      cors,
    );
    if (!r.ok) throw new Error('expected ok');
    expect(r.result.version).toBe('v2');
    expect(r.result.responseHeaders['Deprecation']).toBeUndefined();
    expect(r.result.responseHeaders['Sunset']).toBeUndefined();
  });

  it('versão desconhecida → 400 UNSUPPORTED_VERSION', async () => {
    const r = resolveContractVersion(
      makeReq({ 'X-Contract-Version': 'v9' }),
      productWebhookContracts,
      cors,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.response.status).toBe(400);
    const body = (await r.response.json()) as { code: string };
    expect(body.code).toBe(ERROR_CODES.UNSUPPORTED_VERSION);
  });

  it('lança quando registry está vazio', () => {
    expect(() =>
      resolveContractVersion(makeReq(), {} as Parameters<typeof resolveContractVersion>[1], cors),
    ).toThrow();
  });
});

describe('product-webhook v1/v2 backwards-compat', () => {
  it('v1: payload legado (price: number) continua válido', () => {
    const payload = {
      action: 'upsert',
      product: { sku: 'BRD-001', name: 'Caneta', price: 12.5 },
    };
    expect(productWebhookContracts.v1.schema.safeParse(payload).success).toBe(true);
  });

  it('v2: payload v1 (price: number) é REJEITADO em v2 (price deve ser objeto)', () => {
    const payload = {
      action: 'upsert',
      product: { sku: 'BRD-001', name: 'Caneta', price: 12.5 },
    };
    const r = productWebhookContracts.v2.schema.safeParse(payload);
    expect(r.success).toBe(false);
    if (r.success) return;
    const paths = r.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('product.price');
  });

  it('v2: payload novo (price objeto) é aceito', () => {
    const payload = {
      action: 'upsert',
      product: {
        sku: 'BRD-001',
        name: 'Caneta',
        price: { amount: 12.5, currency: 'BRL' as const },
      },
    };
    expect(productWebhookContracts.v2.schema.safeParse(payload).success).toBe(true);
  });

  it('v2: currency fora do enum é rejeitada com path correto', () => {
    const payload = {
      action: 'upsert',
      product: {
        sku: 'BRD-001',
        name: 'Caneta',
        price: { amount: 12.5, currency: 'JPY' },
      },
    };
    const r = productWebhookContracts.v2.schema.safeParse(payload);
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(
      r.error.issues.some((i) => i.path.join('.') === 'product.price.currency'),
    ).toBe(true);
  });
});
