import { describe, it, expect } from 'vitest';
import {
  sanitizeMessage,
  looksTechnical,
  extractRawMessage,
  PUBLIC_FALLBACK_MESSAGE,
} from '@/lib/security/sanitize-message';

describe('sanitize-message (SSOT)', () => {
  describe('looksTechnical', () => {
    it.each([
      'Error: Failed to fetch',
      'TypeError: x is not a function',
      'UNAUTHORIZED_LEGACY_JWT',
      'at https://app.lovable.app/assets/main.tsx:42',
      '{ "code": "P0001" }',
      'permission denied for function is_admin',
      'duplicate key value violates unique constraint',
    ])('detects %s as technical', (s) => {
      expect(looksTechnical(s)).toBe(true);
    });

    it.each(['Não foi possível salvar', 'Selecione um produto', '', 123, null])(
      'does not flag %s',
      (s) => {
        expect(looksTechnical(s as unknown)).toBe(false);
      },
    );
  });

  describe('extractRawMessage', () => {
    it('extrai de Error', () => {
      expect(extractRawMessage(new Error('boom'))).toBe('boom');
    });
    it('extrai de payload com message', () => {
      expect(extractRawMessage({ message: 'oops' })).toBe('oops');
    });
    it('extrai de payload com error string', () => {
      expect(extractRawMessage({ error: 'denied' })).toBe('denied');
    });
    it('string passthrough', () => {
      expect(extractRawMessage('hi')).toBe('hi');
    });
    it('null → vazio', () => {
      expect(extractRawMessage(null)).toBe('');
    });
  });

  describe('sanitizeMessage (não-dev)', () => {
    it('substitui texto técnico por fallback', () => {
      expect(sanitizeMessage(new Error('TypeError: undefined'))).toBe(PUBLIC_FALLBACK_MESSAGE);
    });

    it('mapeia código canônico (401) para AUTH_GENERIC', () => {
      const out = sanitizeMessage({ status: 401, error: 'unauthorized' });
      expect(out).toMatch(/credenciais/i);
    });

    it('mapeia rate_limited', () => {
      const out = sanitizeMessage({ error: 'rate_limited' });
      expect(out).toMatch(/tentativas/i);
    });

    it('preserva mensagem amigável', () => {
      expect(sanitizeMessage('Selecione um produto')).toBe('Selecione um produto');
    });

    it('fallback custom', () => {
      const out = sanitizeMessage(new Error('Failed to fetch'), {
        fallback: 'Não foi possível salvar.',
      });
      expect(out).toBe('Não foi possível salvar.');
    });

    it('input vazio → fallback', () => {
      expect(sanitizeMessage(null)).toBe(PUBLIC_FALLBACK_MESSAGE);
    });
  });

  describe('sanitizeMessage (dev)', () => {
    it('preserva texto cru técnico para dev', () => {
      expect(sanitizeMessage(new Error('TypeError: undefined'), { isDev: true })).toBe(
        'TypeError: undefined',
      );
    });

    it('dev sem mensagem → fallback', () => {
      expect(sanitizeMessage(null, { isDev: true })).toBe(PUBLIC_FALLBACK_MESSAGE);
    });
  });
});
