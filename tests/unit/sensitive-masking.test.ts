/**
 * Unit tests for src/lib/sensitive-masking.ts
 *
 * maskSecretValue, maskSensitiveText, containsSensitive
 */
import { describe, it, expect } from 'vitest';
import {
  maskSecretValue,
  maskSensitiveText,
  containsSensitive,
} from '@/lib/sensitive-masking';

const BULLET = '•';
const FILL = BULLET.repeat(4);

// ============================================
// maskSecretValue
// ============================================

describe('maskSecretValue', () => {
  it('masks null with ???? placeholder', () => {
    expect(maskSecretValue(null)).toBe(`${FILL}????`);
  });

  it('masks undefined', () => {
    expect(maskSecretValue(undefined)).toBe(`${FILL}????`);
  });

  it('masks empty string', () => {
    expect(maskSecretValue('')).toBe(`${FILL}????`);
  });

  it('shows last 4 chars for values >= 4 chars', () => {
    expect(maskSecretValue('abcdefgh')).toBe(`${FILL}efgh`);
    expect(maskSecretValue('1234')).toBe(`${FILL}1234`);
  });

  it('pads short values with bullets', () => {
    expect(maskSecretValue('ab')).toBe(`${FILL}${BULLET}${BULLET}ab`);
    expect(maskSecretValue('a')).toBe(`${FILL}${BULLET}${BULLET}${BULLET}a`);
  });

  it('always returns string starting with 4 bullets', () => {
    const result = maskSecretValue('super-secret-token-1234');
    expect(result.startsWith(FILL)).toBe(true);
  });

  it('total length is always 8 chars', () => {
    expect([...maskSecretValue('12345678')]).toHaveLength(8);
    expect([...maskSecretValue(null)]).toHaveLength(8);
  });
});

// ============================================
// maskSensitiveText
// ============================================

describe('maskSensitiveText', () => {
  it('returns null when input is null', () => {
    expect(maskSensitiveText(null)).toBeNull();
  });

  it('leaves plain text unchanged', () => {
    const text = 'Produto incrível disponível em estoque';
    expect(maskSensitiveText(text)).toBe(text);
  });

  it('masks Bearer tokens', () => {
    const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const result = maskSensitiveText(text);
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(result).toContain(FILL);
  });

  it('masks query param apikey', () => {
    const text = 'https://api.example.com/data?apikey=supersecret123&limit=10';
    const result = maskSensitiveText(text);
    expect(result).not.toContain('supersecret123');
    expect(result).toContain('?apikey=');
    expect(result).toContain('&limit=10');
  });

  it('masks query param token', () => {
    const text = 'https://api.example.com/data?token=mytoken1234&foo=bar';
    const result = maskSensitiveText(text)!;
    expect(result).not.toContain('mytoken1234');
  });

  it('masks JSON field "password"', () => {
    const text = '{"username":"john","password":"mysecretpassword"}';
    const result = maskSensitiveText(text)!;
    expect(result).not.toContain('mysecretpassword');
    expect(result).toContain('"password"');
  });

  it('masks JWT tokens (three base64url segments)', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const text = `token: ${jwt}`;
    const result = maskSensitiveText(text)!;
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(result).toContain(FILL);
  });

  it('masks supabase project ref URL', () => {
    const text = 'https://abcdefghijklmnop.supabase.co/rest/v1/products';
    const result = maskSensitiveText(text)!;
    expect(result).not.toContain('abcdefghijklmnop');
    expect(result).toContain('supabase.co');
  });

  it('is idempotent (applying twice gives same result)', () => {
    const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4In0.abc12345';
    const once = maskSensitiveText(text)!;
    const twice = maskSensitiveText(once)!;
    expect(twice).toBe(once);
  });
});

// ============================================
// containsSensitive
// ============================================

describe('containsSensitive', () => {
  it('returns false for null', () => {
    expect(containsSensitive(null)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(containsSensitive('')).toBe(false);
  });

  it('returns false for plain text', () => {
    expect(containsSensitive('Olá mundo, produto disponível!')).toBe(false);
  });

  it('detects JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    expect(containsSensitive(jwt)).toBe(true);
  });

  it('detects supabase project URLs', () => {
    expect(containsSensitive('https://doufsxqlfjyuvxuezpln.supabase.co')).toBe(true);
  });

  it('detects apikey in query params', () => {
    expect(containsSensitive('https://api.example.com?apikey=secret123')).toBe(true);
  });

  it('detects token in query params', () => {
    expect(containsSensitive('https://api.example.com?token=secret123')).toBe(true);
  });

  it('detects password in JSON', () => {
    expect(containsSensitive('{"password":"mysecret"}')).toBe(true);
  });

  it('detects Bearer tokens', () => {
    expect(containsSensitive('Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI')).toBe(true);
  });

  it('returns false for already-masked text (bullets = safe)', () => {
    const masked = maskSensitiveText('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4In0.abc12345')!;
    expect(containsSensitive(masked)).toBe(false);
  });
});
