import { describe, it, expect } from 'vitest';
import { parseContract } from '../../supabase/functions/_shared/contracts/parse';
import { SendTransactionalEmailSchemas } from '../../supabase/functions/_shared/contracts/schemas/send-transactional-email';
import { makeRequest, expectContractError } from './_helpers';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('contract: send-transactional-email v1 (compat)', () => {
  it('aceita payload válido (default v1)', async () => {
    const req = makeRequest({
      body: {
        event_type: 'quote_sent',
        recipient_email: 'ana@example.com',
        data: { quote_number: 'Q-001' },
      },
    });
    const r = await parseContract(req, SendTransactionalEmailSchemas);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe('1');
      expect(r.data.recipient_email).toBe('ana@example.com');
      expect(r.responseHeaders['Deprecation']).toBe('true');
    }
  });

  it('aceita recipient_name opcional', async () => {
    const req = makeRequest({
      body: {
        event_type: 'order_created',
        recipient_email: 'cliente@example.com',
        recipient_name: 'João',
        data: {},
      },
    });
    const r = await parseContract(req, SendTransactionalEmailSchemas);
    expect(r.ok).toBe(true);
  });

  it('event_type fora do enum → 422', async () => {
    const req = makeRequest({
      body: {
        event_type: 'invalid_event',
        recipient_email: 'a@b.com',
        data: {},
      },
    });
    const r = await parseContract(req, SendTransactionalEmailSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, { status: 422, code: 'validation_failed' });
    }
  });

  it('email inválido → 422', async () => {
    const req = makeRequest({
      body: { event_type: 'quote_sent', recipient_email: 'not-an-email', data: {} },
    });
    const r = await parseContract(req, SendTransactionalEmailSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, { status: 422, code: 'validation_failed' });
    }
  });

  it('body vazio → 400 missing_body', async () => {
    const req = makeRequest({ body: '' });
    const r = await parseContract(req, SendTransactionalEmailSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, { status: 400, code: 'missing_body' });
    }
  });

  it('JSON malformado → 400 invalid_json', async () => {
    const req = makeRequest({ body: '{broken' });
    const r = await parseContract(req, SendTransactionalEmailSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, { status: 400, code: 'invalid_json' });
    }
  });
});

describe('contract: send-transactional-email v2 (strict + idempotency)', () => {
  it('aceita payload v2 completo via accept-version header', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: {
        event_type: 'quote_approved',
        recipient_email: 'cliente@example.com',
        data: { quote_number: 'Q-002' },
        idempotency_key: UUID,
      },
    });
    const r = await parseContract(req, SendTransactionalEmailSchemas);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe('2');
      // v2 não deprecated → sem header Deprecation
      expect(r.responseHeaders['Deprecation']).toBeUndefined();
    }
  });

  it('v2 sem idempotency_key → 422', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { event_type: 'quote_sent', recipient_email: 'a@b.com', data: {} },
    });
    const r = await parseContract(req, SendTransactionalEmailSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, { status: 422, code: 'validation_failed' });
    }
  });

  it('versão não suportada → 406 unsupported_version', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '99' },
      body: { event_type: 'quote_sent', recipient_email: 'a@b.com', data: {} },
    });
    const r = await parseContract(req, SendTransactionalEmailSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, { status: 406, code: 'unsupported_version' });
    }
  });
});
