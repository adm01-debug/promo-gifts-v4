/**
 * Unit tests for src/lib/connection-error-copy.ts
 *
 * getErrorCopy, getKindBadgeClass, getKindLabel
 */
import { describe, it, expect } from 'vitest';
import { getErrorCopy, getKindBadgeClass, getKindLabel } from '@/lib/connection-error-copy';

// ============================================
// getErrorCopy
// ============================================

describe('getErrorCopy', () => {
  it('returns timeout copy for kind="timeout" without timeoutMs', () => {
    const r = getErrorCopy('timeout');
    expect(r.tone).toBe('timeout');
    expect(r.title).toBe('Tempo esgotado');
    expect(r.hint).toContain('ativo e acessível');
  });

  it('includes timeoutMs in hint when provided', () => {
    const r = getErrorCopy('timeout', null, null, 5000);
    expect(r.hint).toContain('5000ms');
  });

  it('returns network copy for kind="network"', () => {
    const r = getErrorCopy('network');
    expect(r.tone).toBe('network');
    expect(r.title).toBe('Sem conexão com o serviço');
    expect(r.hint).toContain('firewall');
  });

  it('returns dns copy for kind="dns"', () => {
    const r = getErrorCopy('dns');
    expect(r.tone).toBe('dns');
    expect(r.title).toBe('URL não encontrada');
    expect(r.hint).toContain('DNS');
  });

  it('returns auth copy for kind="auth"', () => {
    const r = getErrorCopy('auth');
    expect(r.tone).toBe('auth');
    expect(r.title).toBe('Credenciais rejeitadas');
  });

  it('returns http copy with status in title when status provided', () => {
    const r = getErrorCopy('http', 404);
    expect(r.tone).toBe('http');
    expect(r.title).toBe('Erro HTTP 404');
  });

  it('returns http copy without status number in title when status is null', () => {
    const r = getErrorCopy('http', null);
    expect(r.title).toBe('Erro HTTP');
  });

  it('returns 4xx-specific hint for 4xx HTTP errors', () => {
    const r = getErrorCopy('http', 422);
    expect(r.hint).toContain('payload');
  });

  it('returns 5xx-specific hint for 5xx HTTP errors', () => {
    const r = getErrorCopy('http', 503);
    expect(r.hint).toContain('Instabilidade');
  });

  it('returns config copy for kind="config"', () => {
    const r = getErrorCopy('config');
    expect(r.tone).toBe('config');
    expect(r.title).toBe('Configuração incompleta');
  });

  it('returns unknown copy for kind="unknown"', () => {
    const r = getErrorCopy('unknown');
    expect(r.tone).toBe('unknown');
    expect(r.title).toBe('Falha na conexão');
  });

  it('returns unknown copy for null kind', () => {
    const r = getErrorCopy(null);
    expect(r.tone).toBe('unknown');
  });

  it('returns unknown copy for undefined kind', () => {
    const r = getErrorCopy(undefined);
    expect(r.tone).toBe('unknown');
  });

  it('uses fallbackMessage in unknown hint when provided', () => {
    const r = getErrorCopy(null, null, 'Custom error detail');
    expect(r.hint).toBe('Custom error detail');
  });

  it('ignores blank fallbackMessage and uses generic hint', () => {
    const r = getErrorCopy(null, null, '   ');
    expect(r.hint).toContain('Não foi possível');
  });

  it('every valid kind returns an icon (truthy)', () => {
    const kinds = ['timeout', 'network', 'dns', 'auth', 'http', 'config', 'unknown'] as const;
    for (const kind of kinds) {
      expect(getErrorCopy(kind).icon).toBeTruthy();
    }
  });
});

// ============================================
// getKindBadgeClass
// ============================================

describe('getKindBadgeClass', () => {
  it('returns non-empty string for each tone', () => {
    const tones = ['timeout', 'network', 'dns', 'auth', 'http', 'config', 'unknown'] as const;
    for (const tone of tones) {
      const cls = getKindBadgeClass(tone);
      expect(typeof cls).toBe('string');
      expect(cls.length).toBeGreaterThan(0);
    }
  });

  it('returns different classes for different tones', () => {
    const timeout = getKindBadgeClass('timeout');
    const network = getKindBadgeClass('network');
    const auth = getKindBadgeClass('auth');
    expect(timeout).not.toBe(network);
    expect(network).not.toBe(auth);
  });

  it('timeout uses amber color tokens', () => {
    expect(getKindBadgeClass('timeout')).toContain('amber');
  });

  it('auth uses rose color tokens', () => {
    expect(getKindBadgeClass('auth')).toContain('rose');
  });

  it('dns uses purple color tokens', () => {
    expect(getKindBadgeClass('dns')).toContain('purple');
  });

  it('unknown falls through to muted tokens', () => {
    expect(getKindBadgeClass('unknown')).toContain('muted');
  });
});

// ============================================
// getKindLabel
// ============================================

describe('getKindLabel', () => {
  it('returns correct PT-BR labels for each tone', () => {
    expect(getKindLabel('timeout')).toBe('Timeout');
    expect(getKindLabel('network')).toBe('Rede');
    expect(getKindLabel('dns')).toBe('DNS');
    expect(getKindLabel('auth')).toBe('Auth');
    expect(getKindLabel('http')).toBe('HTTP');
    expect(getKindLabel('config')).toBe('Config');
    expect(getKindLabel('unknown')).toBe('Desconhecido');
  });
});
