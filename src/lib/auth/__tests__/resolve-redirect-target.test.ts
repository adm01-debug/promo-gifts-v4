/**
 * Testes de integração — precedência do redirect pós-login.
 *
 * `resolveRedirectTarget` é a SSOT consumida pelo login Google (após o
 * round-trip OAuth) e pelo login por e-mail/senha (após `signIn`).
 * Cobrimos as 4 fontes da precedência:
 *
 *   1. `location.state.from` (mesma aba — guard de rota privada)
 *   2. `?redirect=/path` (deep-link manual em /auth)
 *   3. `sessionStorage` (sobrevive ao round-trip OAuth)
 *   4. fallback `/`
 *
 * Para cada caso simulamos AMBOS os cenários (vindo do botão Google ou do
 * formulário de e-mail/senha) — a precedência é idêntica porque os dois
 * fluxos chamam a mesma função.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveRedirectTarget } from '@/lib/auth/resolve-redirect-target';
import {
  savePostLoginRedirect,
  peekPostLoginRedirect,
  clearPostLoginRedirect,
} from '@/lib/auth/post-login-redirect';

beforeEach(() => {
  clearPostLoginRedirect();
});
afterEach(() => {
  clearPostLoginRedirect();
});

/**
 * Helper: emula os dois consumidores reais (Google via SSOCallbackPage
 * delegando a `resolveRedirectTarget` via Auth.tsx, e e-mail/senha via
 * `validateAndRedirect`). Como a função é pura, basta variar os inputs.
 */
function callFromGoogleFlow(input: Parameters<typeof resolveRedirectTarget>[0]) {
  return resolveRedirectTarget(input);
}
function callFromEmailPasswordFlow(input: Parameters<typeof resolveRedirectTarget>[0]) {
  return resolveRedirectTarget(input);
}

describe('resolveRedirectTarget — precedência pós-login', () => {
  describe('1️⃣ location.state.from vence todas as outras fontes', () => {
    it('Google: state.from sobrescreve ?redirect e sessionStorage', () => {
      savePostLoginRedirect('/storage-path');
      const result = callFromGoogleFlow({
        fromState: { pathname: '/clientes', search: '?q=acme', hash: '#top' },
        queryRedirect: '/produtos',
      });
      expect(result).toBe('/clientes?q=acme#top');
      // sessionStorage consumido (one-shot) mesmo quando a vitória foi do state
      expect(peekPostLoginRedirect()).toBeNull();
    });

    it('E-mail/senha: state.from idem', () => {
      savePostLoginRedirect('/storage-path');
      const result = callFromEmailPasswordFlow({
        fromState: { pathname: '/orcamentos/novo' },
        queryRedirect: '/produtos',
      });
      expect(result).toBe('/orcamentos/novo');
      expect(peekPostLoginRedirect()).toBeNull();
    });

    it('state.from inválido (rota de auth) é rejeitado e cai para próxima fonte', () => {
      const result = resolveRedirectTarget({
        fromState: { pathname: '/auth' }, // bloqueado por isSafeRedirectPath
        queryRedirect: '/produtos', // fonte #2 assume
      });
      expect(result).toBe('/produtos');
    });
  });

  describe('2️⃣ ?redirect vence quando não há state.from', () => {
    it('Google: query param respeitado', () => {
      const result = callFromGoogleFlow({
        fromState: null,
        queryRedirect: '/favoritos',
      });
      expect(result).toBe('/favoritos');
    });

    it('E-mail/senha: query param respeitado', () => {
      const result = callFromEmailPasswordFlow({
        fromState: null,
        queryRedirect: '/colecoes',
      });
      expect(result).toBe('/colecoes');
    });

    it('?redirect inválido (esquema externo) cai para fallback /', () => {
      const result = resolveRedirectTarget({
        fromState: null,
        queryRedirect: 'https://evil.com/phish',
      });
      expect(result).toBe('/');
    });

    it('?redirect protocol-relative (//evil.com) cai para fallback /', () => {
      const result = resolveRedirectTarget({
        fromState: null,
        queryRedirect: '//evil.com',
      });
      expect(result).toBe('/');
    });
  });

  describe('3️⃣ sessionStorage vence quando não há state.from nem ?redirect', () => {
    it('Google (round-trip OAuth): consome valor salvo antes do redirect', () => {
      savePostLoginRedirect('/orcamentos/123');
      const result = callFromGoogleFlow({ fromState: null, queryRedirect: null });
      expect(result).toBe('/orcamentos/123');
      // one-shot: limpou o sessionStorage
      expect(peekPostLoginRedirect()).toBeNull();
    });

    it('E-mail/senha (mesma aba sem state): consome valor salvo', () => {
      savePostLoginRedirect('/produtos?categoria=mochilas');
      const result = callFromEmailPasswordFlow({ fromState: null, queryRedirect: null });
      expect(result).toBe('/produtos?categoria=mochilas');
      expect(peekPostLoginRedirect()).toBeNull();
    });
  });

  describe('4️⃣ fallback "/" quando todas as fontes ausentes/inválidas', () => {
    it('Google: sem nada → home', () => {
      const result = callFromGoogleFlow({ fromState: null, queryRedirect: null });
      expect(result).toBe('/');
    });

    it('E-mail/senha: sem nada → home', () => {
      const result = callFromEmailPasswordFlow({ fromState: null, queryRedirect: null });
      expect(result).toBe('/');
    });

    it('Todas as fontes inválidas simultaneamente → home', () => {
      savePostLoginRedirect('/login'); // rejeitado pelo isSafeRedirectPath
      // savePostLoginRedirect não persiste paths inválidos, então sessionStorage fica vazio
      expect(peekPostLoginRedirect()).toBeNull();
      const result = resolveRedirectTarget({
        fromState: { pathname: '/reset-password' }, // bloqueado
        // eslint-disable-next-line no-script-url -- test fixture: verifying javascript: protocol is rejected
        queryRedirect: 'javascript:alert(1)', // bloqueado
      });
      expect(result).toBe('/');
    });
  });

  describe('🔁 Idempotência — chamadas sucessivas', () => {
    it('Segunda chamada após consumir sessionStorage cai para fallback', () => {
      savePostLoginRedirect('/dashboard');
      expect(resolveRedirectTarget({ fromState: null, queryRedirect: null })).toBe('/dashboard');
      // Sem refresh: segunda chamada não tem mais valor → fallback
      expect(resolveRedirectTarget({ fromState: null, queryRedirect: null })).toBe('/');
    });

    it('state.from continua disponível em múltiplas chamadas (não é one-shot)', () => {
      const input = { fromState: { pathname: '/produtos' }, queryRedirect: null };
      expect(resolveRedirectTarget(input)).toBe('/produtos');
      expect(resolveRedirectTarget(input)).toBe('/produtos');
    });
  });

  describe('🛡️ Defesa-em-profundidade — rotas de auth NUNCA passam', () => {
    const authVariants = [
      '/auth',
      '/auth/callback',
      '/auth?redirect=/x',
      '/AUTH/callback', // case-insensitive
      '/login',
      '/logout',
      '/signup',
      '/sign-up',
      '/register',
      '/reset-password',
      '/forgot-password',
      '/unauthorized',
      '/%61uth', // URL-encoded 'a' → /auth
      '/%2Fauth', // encoded slash → //auth (protocol-relative)
      '/%252Fauth', // doubly-encoded
      '/auth%2Fcallback', // /auth/callback após decode
    ];

    it.each(authVariants)('state.from = %s é rejeitado e cai para fallback', (path) => {
      const result = resolveRedirectTarget({
        fromState: { pathname: path },
        queryRedirect: null,
      });
      expect(result).toBe('/');
    });

    it.each(authVariants)('?redirect = %s é rejeitado e cai para fallback', (path) => {
      const result = resolveRedirectTarget({
        fromState: null,
        queryRedirect: path,
      });
      expect(result).toBe('/');
    });

    it('state.from /auth com query/hash maliciosa também é bloqueado', () => {
      const result = resolveRedirectTarget({
        fromState: { pathname: '/auth', search: '?redirect=/admin', hash: '#x' },
        queryRedirect: '/produtos',
      });
      // state.from inválido → cai para ?redirect (válido)
      expect(result).toBe('/produtos');
    });
  });
});
