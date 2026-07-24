import { describe, expect, it } from 'vitest';
import { sanitizeError, SAFE_MESSAGES } from './sanitize-error';

describe('sanitizeError', () => {
  it('mapeia falha controlada de dependência para mensagem genérica', () => {
    const message = sanitizeError({
      code: 'dependency_unavailable',
      message: 'Dependency inventory-api unavailable: connect ETIMEDOUT',
      status: 503,
    });

    expect(message).toBe(SAFE_MESSAGES.GENERIC);
  });

  it('não vaza detalhe técnico de falha upstream em texto cru', () => {
    const message = sanitizeError({
      message: 'service temporarily unavailable: boot_error failed to fetch',
    });

    expect(message).toBe(SAFE_MESSAGES.GENERIC);
  });
});
