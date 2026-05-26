import { describe, expect, it } from 'vitest';
import { isDuplicateAccountError } from '@/lib/auth/is-duplicate-account-error';

describe('isDuplicateAccountError', () => {
  it('identifica mensagens de conta duplicada', () => {
    expect(isDuplicateAccountError('User already been registered')).toBe(true);
    expect(isDuplicateAccountError('already exists')).toBe(true);
    expect(isDuplicateAccountError('duplicate key value violates unique constraint')).toBe(true);
  });

  it('não marca erros genéricos como duplicidade', () => {
    expect(isDuplicateAccountError('network timeout')).toBe(false);
  });
});
