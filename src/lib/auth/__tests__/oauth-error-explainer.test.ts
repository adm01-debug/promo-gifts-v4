import { describe, it, expect } from 'vitest';
import { explainOAuthError } from '@/lib/auth/oauth-error-explainer';

describe('explainOAuthError', () => {
  describe('config errors (admin needs to act)', () => {
    it('mapeia redirect_uri_mismatch com hint sobre console do provedor', () => {
      const r = explainOAuthError({ error: 'redirect_uri_mismatch', description: null });
      expect(r.code).toBe('redirect_uri_mismatch');
      expect(r.severity).toBe('config');
      expect(r.title).toMatch(/Redirect URI/i);
      expect(r.hint).toMatch(/Authorized redirect/i);
    });

    it('detecta redirect uri mismatch pela descrição quando code é genérico', () => {
      const r = explainOAuthError({
        error: 'invalid_request',
        description: 'The redirect URI in the request does not match the ones authorized.',
      });
      expect(r.code).toBe('redirect_uri_mismatch');
      expect(r.severity).toBe('config');
    });

    it('mapeia provider_not_enabled com hint para o admin', () => {
      const r = explainOAuthError({ error: 'provider_not_enabled', description: null });
      expect(r.code).toBe('provider_not_enabled');
      expect(r.severity).toBe('config');
      expect(r.hint).toMatch(/Administrador|admin/i);
      expect(r.hint).toMatch(/Sign In Methods|Authentication/i);
    });

    it('detecta provider desabilitado pela descrição', () => {
      const r = explainOAuthError({
        error: 'server_error',
        description: 'Unsupported provider: provider is not enabled',
      });
      expect(r.code).toBe('provider_not_enabled');
    });

    it('mapeia invalid_client / unauthorized_client', () => {
      expect(explainOAuthError({ error: 'invalid_client' }).severity).toBe('config');
      expect(explainOAuthError({ error: 'unauthorized_client' }).severity).toBe('config');
    });
  });

  describe('user errors (user needs to act)', () => {
    it('access_denied = cancelamento amigável', () => {
      const r = explainOAuthError({ error: 'access_denied' });
      expect(r.severity).toBe('user');
      expect(r.title).toMatch(/cancel/i);
    });

    it('user_banned bloqueia com mensagem clara', () => {
      const r = explainOAuthError({ error: 'user_banned' });
      expect(r.severity).toBe('user');
      expect(r.hint).toMatch(/administrador/i);
    });
  });

  describe('transient errors (retry)', () => {
    it('server_error → transient', () => {
      const r = explainOAuthError({ error: 'server_error' });
      expect(r.severity).toBe('transient');
    });

    it('invalid_grant orienta voltar e tentar de novo', () => {
      const r = explainOAuthError({ error: 'invalid_grant' });
      expect(r.severity).toBe('transient');
      expect(r.hint).toMatch(/novamente/i);
    });

    it('timeout detectado por descrição', () => {
      const r = explainOAuthError({ description: 'Sessão não estabelecida. Tente novamente.' });
      expect(r.code).toBe('timeout');
      expect(r.severity).toBe('transient');
    });

    it('network error detectado por "Failed to fetch"', () => {
      const r = explainOAuthError({ description: 'Failed to fetch' });
      expect(r.code).toBe('network');
    });
  });

  describe('fallback', () => {
    it('retorna unknown com mensagem genérica quando nada bate', () => {
      const r = explainOAuthError({ error: 'meteor_strike', description: 'wat' });
      expect(r.code).toBe('meteor_strike');
      expect(r.severity).toBe('unknown');
      expect(r.description).toBe('wat');
      expect(r.hint).toBeTruthy();
    });

    it('aceita inputs vazios sem quebrar', () => {
      const r = explainOAuthError({});
      expect(r.code).toBe('unknown');
      expect(r.title).toBeTruthy();
      expect(r.hint).toBeTruthy();
    });
  });

  it('todas as respostas incluem title, description e hint não-vazios', () => {
    const codes = [
      'redirect_uri_mismatch',
      'unauthorized_client',
      'invalid_client',
      'provider_not_enabled',
      'access_denied',
      'invalid_request',
      'server_error',
      'invalid_grant',
      'email_not_confirmed',
      'user_banned',
      'otp_expired',
    ];
    for (const c of codes) {
      const r = explainOAuthError({ error: c });
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(0);
      expect(r.hint.length).toBeGreaterThan(0);
    }
  });
});
