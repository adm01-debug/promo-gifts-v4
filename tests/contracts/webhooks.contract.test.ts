import { describe, it, expect } from 'vitest';
import { parseContract } from '../../supabase/functions/_shared/contracts/parse';
import { WebhookInboundSchemas } from '../../supabase/functions/_shared/contracts/schemas/webhook-inbound';
import { WebhookDispatcherSchemas } from '../../supabase/functions/_shared/contracts/schemas/webhook-dispatcher';
import { makeRequest, expectContractError } from './_helpers';

// ─── webhook-inbound ───────────────────────────────────────

describe('contract: webhook-inbound v1 (passthrough)', () => {
  it('aceita qualquer objeto (compat com produção)', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '1' },
      body: { hello: 'world', random: 42 },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe('1');
  });

  it('aceita array (compat — v1 é any)', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '1' },
      body: [1, 2, 3],
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(true);
  });

  it('body vazio → 400 missing_body', async () => {
    const req = makeRequest({ body: '' });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 400,
        code: 'missing_body',
      });
    }
  });
});

describe('contract: webhook-inbound v2 (envelope strict)', () => {
  const validV2 = {
    event: 'order.created',
    occurred_at: '2026-05-21T10:00:00Z',
    data: { order_id: 'abc' },
  };

  it('envelope válido', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: validV2,
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe('2');
  });

  it('sem event → 422', async () => {
    const { event: _e, ...rest } = validV2;
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: rest,
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 422,
        code: 'validation_failed',
        fieldPaths: ['event'],
      });
    }
  });

  it('occurred_at não-ISO → 422', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { ...validV2, occurred_at: 'ontem às 10h' },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 422,
        code: 'validation_failed',
        fieldPaths: ['occurred_at'],
      });
    }
  });

  it('event com chars inválidos → 422', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { ...validV2, event: 'order created!!' },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
  });

  it('idempotency_key precisa ser UUID quando presente', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { ...validV2, idempotency_key: 'not-a-uuid' },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 422,
        code: 'validation_failed',
        fieldPaths: ['idempotency_key'],
      });
    }
  });
});

// ─── webhook-dispatcher ────────────────────────────────────

describe('contract: webhook-dispatcher v1 (compat)', () => {
  it('aceita {event, payload}', async () => {
    const req = makeRequest({
      body: { event: 'test.fired', payload: { a: 1 } },
    });
    const r = await parseContract(req, WebhookDispatcherSchemas);
    expect(r.ok).toBe(true);
  });

  it('aceita replay_delivery_id UUID', async () => {
    const req = makeRequest({
      body: {
        event: 'noop',
        replay_delivery_id: '11111111-2222-3333-4444-555555555555',
      },
    });
    const r = await parseContract(req, WebhookDispatcherSchemas);
    expect(r.ok).toBe(true);
  });

  it('event vazio → 422', async () => {
    const req = makeRequest({ body: { event: '' } });
    const r = await parseContract(req, WebhookDispatcherSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 422,
        code: 'validation_failed',
        fieldPaths: ['event'],
      });
    }
  });
});

describe('contract: webhook-dispatcher v2 (discriminated union)', () => {
  it("mode='dispatch' válido", async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { mode: 'dispatch', event: 'order.created', payload: { id: 1 } },
    });
    const r = await parseContract(req, WebhookDispatcherSchemas);
    expect(r.ok).toBe(true);
  });

  it("mode='replay' válido apenas com UUID", async () => {
    const ok = makeRequest({
      headers: { 'accept-version': '2' },
      body: {
        mode: 'replay',
        replay_delivery_id: '11111111-2222-3333-4444-555555555555',
      },
    });
    const okR = await parseContract(ok, WebhookDispatcherSchemas);
    expect(okR.ok).toBe(true);

    const bad = makeRequest({
      headers: { 'accept-version': '2' },
      body: { mode: 'replay', replay_delivery_id: 'abc' },
    });
    const badR = await parseContract(bad, WebhookDispatcherSchemas);
    expect(badR.ok).toBe(false);
  });

  it("mode='test' exige test_webhook_id", async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { mode: 'test', event: 'x', payload: {} },
    });
    const r = await parseContract(req, WebhookDispatcherSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, {
        status: 422,
        code: 'validation_failed',
        fieldPaths: ['test_webhook_id'],
      });
    }
  });

  it('mode inválido → 422', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { mode: 'delete-everything' },
    });
    const r = await parseContract(req, WebhookDispatcherSchemas);
    expect(r.ok).toBe(false);
  });

  it('v2 não aceita payload extra fora do schema (strict)', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { mode: 'dispatch', event: 'ok', payload: {}, hidden: true },
    });
    const r = await parseContract(req, WebhookDispatcherSchemas);
    expect(r.ok).toBe(false);
  });
});
