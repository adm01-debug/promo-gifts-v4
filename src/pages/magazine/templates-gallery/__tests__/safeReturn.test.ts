import { describe, it, expect } from 'vitest';
import { parseReturnTo } from '../safeReturn';

describe('parseReturnTo — happy paths', () => {
  it('aceita UUID válido', () => {
    const r = parseReturnTo('/magazine/550e8400-e29b-41d4-a716-446655440000');
    expect(r).toEqual({
      path: '/magazine/550e8400-e29b-41d4-a716-446655440000',
      magazineId: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('aceita slug alfanumérico curto', () => {
    expect(parseReturnTo('/magazine/abc123')).toEqual({
      path: '/magazine/abc123',
      magazineId: 'abc123',
    });
  });

  it('aceita id com hífen e underscore', () => {
    expect(parseReturnTo('/magazine/mag_2026-07')?.magazineId).toBe('mag_2026-07');
  });

  it('descarta querystring silenciosamente', () => {
    expect(parseReturnTo('/magazine/abc123?foo=bar')?.path).toBe('/magazine/abc123');
  });

  it('descarta hash silenciosamente', () => {
    expect(parseReturnTo('/magazine/abc123#seção')?.path).toBe('/magazine/abc123');
  });
});

describe('parseReturnTo — inputs inválidos', () => {
  const malicious: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['número', 42],
    ['objeto', {}],
    ['string vazia', ''],
    ['espaço', '   '],
    ['string gigante', '/magazine/' + 'a'.repeat(300)],
  ];

  for (const [name, value] of malicious) {
    it(`rejeita ${name}`, () => {
      expect(parseReturnTo(value as string)).toBeNull();
    });
  }
});

describe('parseReturnTo — open redirect / SSRF', () => {
  const attackers = [
    '//evil.com/magazine/abc123',
    '//evil.com',
    'https://evil.com/magazine/abc123',
    'http://evil.com',
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '\\\\evil.com\\magazine\\abc',
    '/\\evil.com/magazine/abc',
    '/magazine//evil.com/abc',
    '/magazine/../admin',
    '/magazine/abc/../../../etc',
    '/magazine/abc/extra',
    '/other/abc123',
    'magazine/abc123', // sem barra inicial
    '/Magazine/abc123', // case-sensitive
    '/magazine/', // id vazio
    '/magazine',
    '/magazine/ab', // id curto demais
    '/magazine/abc def', // espaço
    '/magazine/abc$%^',
    '/magazine/abc?returnTo=//evil.com',
    '/magazine/abc\r\nSet-Cookie: x',
    '/magazine/abc\u0000',
  ];

  for (const a of attackers) {
    it(`rejeita: ${JSON.stringify(a)}`, () => {
      expect(parseReturnTo(a)).toBeNull();
    });
  }
});

describe('parseReturnTo — path traversal & normalização', () => {
  it('não faz decode de %2F', () => {
    // %2F literal não é barra, então id "abc%2Fadmin" (>=6 chars) passa no regex?
    // O regex ID_RE proíbe % — deve rejeitar.
    expect(parseReturnTo('/magazine/abc%2Fadmin')).toBeNull();
  });

  it('rejeita id com barra codificada', () => {
    expect(parseReturnTo('/magazine/abc/def')).toBeNull();
  });
});
