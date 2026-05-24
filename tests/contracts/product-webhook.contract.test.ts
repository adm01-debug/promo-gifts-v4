import { describe, it, expect } from 'vitest';
import { parseContract } from '../../supabase/functions/_shared/contracts/parse';
import { ProductWebhookSchemas } from '../../supabase/functions/_shared/contracts/schemas/product-webhook';
import { makeRequest, expectContractError } from './_helpers';

describe('contract: product-webhook v1 (compat com produção)', () => {
  it('aceita payload válido (upsert, default v1)', async () => {
    const req = makeRequest({
      body: {
        action: 'upsert',
        product: { sku: 'ABC123', name: 'Caneta', price: 5.5 },
      },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe('1');
      expect(r.data.action).toBe('upsert');
      expect(r.responseHeaders['Deprecation']).toBe('true');
    }
  });

  it('payload sem body → 400 missing_body', async () => {
    const req = makeRequest({ body: '' });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 400,
        code: 'missing_body',
      });
    }
  });

  it('JSON quebrado → 400 invalid_json', async () => {
    const req = makeRequest({ body: '{not-json' });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 400,
        code: 'invalid_json',
      });
    }
  });

  it("action inválido → 422 validation_failed em fields", async () => {
    const req = makeRequest({
      body: {
        action: 'explode',
        product: { sku: 'X', name: 'Y', price: 1 },
      },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 422,
        code: 'validation_failed',
        fieldPaths: ['action'],
      });
    }
  });

  it('tipo errado em price (string em vez de number) → 422', async () => {
    const req = makeRequest({
      body: {
        action: 'upsert',
        product: { sku: 'X', name: 'Y', price: 'free' },
      },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 422,
        code: 'validation_failed',
        fieldPaths: ['product.price'],
      });
    }
  });

  it("sku vazio ('') → 422 too_small", async () => {
    const req = makeRequest({
      body: { action: 'upsert', product: { sku: '', name: 'Y', price: 1 } },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const body = await r.response.json();
      const issue = body.fields.find(
        (f: { path: string }) => f.path === 'product.sku'
      );
      expect(issue).toBeDefined();
    }
  });
});

describe('contract: product-webhook v2 (strict)', () => {
  const validV2 = {
    action: 'upsert',
    idempotency_key: '11111111-2222-3333-4444-555555555555',
    product: {
      external_id: 'ext-001',
      sku: 'ABC',
      name: 'Caneta',
      price: 5.5,
    },
  };

  it('payload válido com accept-version: 2', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: validV2,
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe('2');
      expect(r.responseHeaders['Deprecation']).toBeUndefined();
    }
  });

  it('v2 sem idempotency_key → 422', async () => {
    const { idempotency_key: _ik, ...rest } = validV2;
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: rest,
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 422,
        code: 'validation_failed',
        fieldPaths: ['idempotency_key'],
      });
    }
  });

  it('v2 strict: campo extra desconhecido → 422', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { ...validV2, totally_random_field: 123 },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const body = await r.response.json();
      expect(body.code).toBe('validation_failed');
    }
  });

  it("v2 action='delete' sem external_ids → 422", async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: {
        action: 'delete',
        idempotency_key: '11111111-2222-3333-4444-555555555555',
      },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 422,
        code: 'validation_failed',
        fieldPaths: ['external_ids'],
      });
    }
  });

  it('v2 batch_upsert com products=[] → 422', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: {
        action: 'batch_upsert',
        idempotency_key: '11111111-2222-3333-4444-555555555555',
        products: [],
      },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 422,
        code: 'validation_failed',
        fieldPaths: ['products'],
      });
    }
  });

  it("v2 não aceita action='sync' (foi removido em v2)", async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { ...validV2, action: 'sync' },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 422,
        code: 'validation_failed',
        fieldPaths: ['action'],
      });
    }
  });

  it('versão inexistente → 406 unsupported_version', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '99' },
      body: validV2,
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(406);
    }
  });
});
