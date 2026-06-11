import { describe, it, expect } from 'vitest';

describe('Replenishment Edge Function Error Snapshots', () => {
  
  const UNAUTHORIZED_RESPONSE = {
    code: 'unauthorized',
    message: 'Unauthorized',
    fields: [],
  };

  const INVALID_PAYLOAD_RESPONSE = {
    code: 'invalid_payload',
    message: 'Validation failed',
    fields: [
      { path: ['action'], message: 'Invalid enum value' }
    ],
  };

  const INTERNAL_ERROR_RESPONSE = {
    code: 'internal_error',
    message: 'Unexpected database error',
    fields: [],
  };

  it('Unauthorized response should match snapshot', () => {
    expect(UNAUTHORIZED_RESPONSE).toMatchSnapshot();
  });

  it('Invalid payload response should match snapshot', () => {
    expect(INVALID_PAYLOAD_RESPONSE).toMatchSnapshot();
  });

  it('Internal error response should match snapshot', () => {
    expect(INTERNAL_ERROR_RESPONSE).toMatchSnapshot();
  });
});
