import { describe, it, expect } from 'vitest';
import { parseContract } from '../../supabase/functions/_shared/contracts/parse';
import { StepUpVerifySchemas } from '../../supabase/functions/_shared/contracts/schemas/step-up-verify';
import { makeRequest, expectContractError } from './_helpers';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('contract: step-up-verify v1 (compat permissiva)', () => {
  it('aceita step=request com action', async () => {
    const req = makeRequest({
      body: { step: 'request', action: 'promote_dev' },
    });
    const r = await parseContract(req, StepUpVerifySchemas);
    expect(r.ok).toBe(true);
  });

  it('aceita step=verify_password com challenge_id+password', async () => {
    const req = makeRequest({
      body: { step: 'verify_password', challenge_id: 'abc', password: 'x' },
    });
    const r = await parseContract(req, StepUpVerifySchemas);
    expect(r.ok).toBe(true);
  });

  it('step desconhecido → 422', async () => {
    const req = makeRequest({ body: { step: 'unknown' } });
    const r = await parseContract(req, StepUpVerifySchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      await expectContractError(r.response, { status: 422, code: 'validation_failed' });
    }
  });
});

describe('contract: step-up-verify v2 (discriminated union strict)', () => {
  it('request: exige action', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { step: 'request' },
    });
    const r = await parseContract(req, StepUpVerifySchemas);
    expect(r.ok).toBe(false);
  });

  it('request: aceita com action válido', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { step: 'request', action: 'secret_rotation' },
    });
    const r = await parseContract(req, StepUpVerifySchemas);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe('2');
  });

  it('verify_password: exige challenge_id (UUID) + password', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { step: 'verify_password', challenge_id: 'not-a-uuid', password: 'x' },
    });
    const r = await parseContract(req, StepUpVerifySchemas);
    expect(r.ok).toBe(false);
  });

  it('verify_password: aceita challenge_id UUID válido', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { step: 'verify_password', challenge_id: UUID, password: 'senha-123' },
    });
    const r = await parseContract(req, StepUpVerifySchemas);
    expect(r.ok).toBe(true);
  });

  it('verify_otp: exige otp min 4 chars', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { step: 'verify_otp', challenge_id: UUID, otp: 'abc' },
    });
    const r = await parseContract(req, StepUpVerifySchemas);
    expect(r.ok).toBe(false);
  });

  it('cancel: aceita só com challenge_id', async () => {
    const req = makeRequest({
      headers: { 'accept-version': '2' },
      body: { step: 'cancel', challenge_id: UUID },
    });
    const r = await parseContract(req, StepUpVerifySchemas);
    expect(r.ok).toBe(true);
  });
});
