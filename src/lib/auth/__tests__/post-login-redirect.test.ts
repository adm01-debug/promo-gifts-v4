/**
 * Testes unitarios — post-login-redirect (sessionStorage helper).
 *
 * Cobrimos:
 *  - clearPostLoginRedirect remove a chave do sessionStorage
 *  - clearPostLoginRedirect nao lanca erro com sessionStorage vazio
 *  - clearPostLoginRedirect nao lanca erro quando sessionStorage esta indisponivel
 *  - A chave de armazenamento e consistente entre save e clear
 *  - Round-trip: save -> clear -> consume retorna fallback
 *  - isSafeRedirectPath rejeita caminhos perigosos
 *  - consumePostLoginRedirect remove a chave apos leitura (one-shot)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  savePostLoginRedirect,
  peekPostLoginRedirect,
  consumePostLoginRedirect,
  clearPostLoginRedirect,
  isSafeRedirectPath,
  isAuthRoutePath,
} from '@/lib/auth/post-login-redirect';

// Chave interna usada pelo modulo — espelhada aqui para verificar consistencia.
const EXPECTED_KEY = 'auth:post_login_redirect';

beforeEach(() => {
  sessionStorage.clear();
});
afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// clearPostLoginRedirect
// ---------------------------------------------------------------------------
describe('clearPostLoginRedirect', () => {
  it('remove a chave do sessionStorage quando ela existe', () => {
    sessionStorage.setItem(EXPECTED_KEY, '/dashboard');
    expect(sessionStorage.getItem(EXPECTED_KEY)).toBe('/dashboard');

    clearPostLoginRedirect();

    expect(sessionStorage.getItem(EXPECTED_KEY)).toBeNull();
  });

  it('nao lanca erro quando sessionStorage esta vazio', () => {
    expect(sessionStorage.getItem(EXPECTED_KEY)).toBeNull();
    expect(() => clearPostLoginRedirect()).not.toThrow();
  });

  it('nao lanca erro quando sessionStorage.removeItem lanca excecao', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Storage disabled', 'SecurityError');
    });

    expect(() => clearPostLoginRedirect()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Consistencia da chave entre save e clear
// ---------------------------------------------------------------------------
describe('consistencia da chave de armazenamento', () => {
  it('save e clear operam sobre a mesma chave', () => {
    savePostLoginRedirect('/products');

    // A chave interna gravada deve ser a esperada
    expect(sessionStorage.getItem(EXPECTED_KEY)).toBe('/products');

    clearPostLoginRedirect();
    expect(sessionStorage.getItem(EXPECTED_KEY)).toBeNull();
  });

  it('save nao grava chaves extras no sessionStorage', () => {
    const before = sessionStorage.length;
    savePostLoginRedirect('/catalog');
    // Deve ter exatamente 1 chave a mais
    expect(sessionStorage.length).toBe(before + 1);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: save -> clear -> consume
// ---------------------------------------------------------------------------
describe('round-trip save -> clear -> consume', () => {
  it('consume retorna fallback apos clear', () => {
    savePostLoginRedirect('/orders/123');
    expect(peekPostLoginRedirect()).toBe('/orders/123');

    clearPostLoginRedirect();

    // Apos limpar, consume deve retornar o fallback
    expect(consumePostLoginRedirect()).toBe('/');
    expect(consumePostLoginRedirect('/home')).toBe('/home');
  });

  it('consume sem clear retorna o valor salvo e remove a chave (one-shot)', () => {
    savePostLoginRedirect('/settings');

    const result = consumePostLoginRedirect();
    expect(result).toBe('/settings');

    // Segunda chamada retorna fallback porque a chave foi removida
    expect(consumePostLoginRedirect()).toBe('/');
    expect(sessionStorage.getItem(EXPECTED_KEY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// peekPostLoginRedirect
// ---------------------------------------------------------------------------
describe('peekPostLoginRedirect', () => {
  it('retorna null quando nao ha valor salvo', () => {
    expect(peekPostLoginRedirect()).toBeNull();
  });

  it('retorna o valor salvo sem remove-lo', () => {
    savePostLoginRedirect('/budgets');
    expect(peekPostLoginRedirect()).toBe('/budgets');
    // Confirma que o valor ainda esta la
    expect(peekPostLoginRedirect()).toBe('/budgets');
  });

  it('retorna null quando sessionStorage lanca excecao', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage disabled', 'SecurityError');
    });
    expect(peekPostLoginRedirect()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// savePostLoginRedirect — rejeicao de paths inseguros
// ---------------------------------------------------------------------------
describe('savePostLoginRedirect — validacao de seguranca', () => {
  it('nao salva paths que apontam para rotas de auth (anti-loop)', () => {
    savePostLoginRedirect('/auth');
    expect(sessionStorage.getItem(EXPECTED_KEY)).toBeNull();

    savePostLoginRedirect('/auth/callback');
    expect(sessionStorage.getItem(EXPECTED_KEY)).toBeNull();

    savePostLoginRedirect('/login');
    expect(sessionStorage.getItem(EXPECTED_KEY)).toBeNull();
  });

  it('nao salva paths com protocol-relative (//) ou esquemas', () => {
    savePostLoginRedirect('//evil.com');
    expect(sessionStorage.getItem(EXPECTED_KEY)).toBeNull();

    // eslint-disable-next-line no-script-url -- test fixture: verifying javascript: protocol is rejected
    savePostLoginRedirect('javascript:alert(1)');
    expect(sessionStorage.getItem(EXPECTED_KEY)).toBeNull();
  });

  it('nao salva strings vazias ou nao-strings', () => {
    savePostLoginRedirect('');
    expect(sessionStorage.getItem(EXPECTED_KEY)).toBeNull();
  });

  it('nao lanca erro quando sessionStorage.setItem lanca excecao', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    expect(() => savePostLoginRedirect('/valid-path')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// isSafeRedirectPath — cobertura direta
// ---------------------------------------------------------------------------
describe('isSafeRedirectPath', () => {
  it.each(['/dashboard', '/products/123', '/settings?tab=profile', '/catalog#section'])(
    'aceita path interno valido: %s',
    (path) => {
      expect(isSafeRedirectPath(path)).toBe(true);
    },
  );

  it.each([
    '',
    '//evil.com',
    '/\\evil',
    // eslint-disable-next-line no-script-url -- test fixture: verifying javascript: protocol is rejected
    'javascript:alert(1)',
    'data:text/html,<h1>hi</h1>',
    '/auth',
    '/auth/callback',
    '/login',
    '/logout',
    '/signup',
    '/reset-password',
  ])('rejeita path perigoso: %s', (path) => {
    expect(isSafeRedirectPath(path)).toBe(false);
  });

  it('rejeita valores que nao sao string', () => {
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
    expect(isSafeRedirectPath(123)).toBe(false);
    expect(isSafeRedirectPath({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isAuthRoutePath
// ---------------------------------------------------------------------------
describe('isAuthRoutePath', () => {
  it('reconhece rotas de autenticacao', () => {
    expect(isAuthRoutePath('/auth')).toBe(true);
    expect(isAuthRoutePath('/auth/callback')).toBe(true);
    expect(isAuthRoutePath('/login')).toBe(true);
    expect(isAuthRoutePath('/logout')).toBe(true);
  });

  it('nao reconhece rotas normais como auth', () => {
    expect(isAuthRoutePath('/dashboard')).toBe(false);
    expect(isAuthRoutePath('/authentication')).toBe(false);
    expect(isAuthRoutePath('/products')).toBe(false);
  });
});
