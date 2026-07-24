import { describe, it, expect } from 'vitest';
import { parseContract } from '../../supabase/functions/_shared/contracts/parse';
import { SyncExternalDbSchemas } from '../../supabase/functions/_shared/contracts/schemas/sync-external-db';
import { makeRequest, expectContractError } from './_helpers';

describe('contract: sync-external-db (Reposição Module)', () => {
  it('v1: aceita payload mínimo válido', async () => {
    const req = makeRequest({
      body: {
        table: 'products',
      },
    });
    const r = await parseContract(req, SyncExternalDbSchemas);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe('1');
      expect(r.data.table).toBe('products');
      // RFC 8594: Deprecation é booleano; a data de corte vai no header Sunset
      expect(r.responseHeaders['Deprecation']).toBe('true');
      expect(r.responseHeaders['Sunset']).toContain('2026');
    }
  });

  it('v1: aceita campos opcionais', async () => {
    const req = makeRequest({
      body: {
        table: 'inventory_replenishment',
        direction: 'from-external',
        since: '2026-01-01',
      },
    });
    const r = await parseContract(req, SyncExternalDbSchemas);
    expect(r.ok).toBe(true);
  });

  it('v1: rejeita table vazio', async () => {
    const req = makeRequest({
      body: { table: '' },
    });
    const r = await parseContract(req, SyncExternalDbSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 422,
        code: 'validation_failed',
        fieldPaths: ['table'],
      });
    }
  });

  it('v2: aceita payload estrito válido', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: {
        table: 'products',
        direction: 'to-external',
        since: '2026-06-10T15:00:00Z',
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
      },
    });
    const r = await parseContract(req, SyncExternalDbSchemas);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe('2');
      expect(r.responseHeaders['Deprecation']).toBeUndefined();
    }
  });

  it('v2: rejeita campo extra (strict)', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: {
        table: 'products',
        direction: 'to-external',
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
        extra: 'not allowed',
      },
    });
    const r = await parseContract(req, SyncExternalDbSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 422,
        code: 'validation_failed',
      });
    }
  });

  it('v2: rejeita since inválido (não-ISO)', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: {
        table: 'products',
        direction: 'to-external',
        since: '2026-06-10', // Faltando tempo/offset para z.datetime()
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
      },
    });
    const r = await parseContract(req, SyncExternalDbSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 422,
        code: 'validation_failed',
        fieldPaths: ['since'],
      });
    }
  });
});
