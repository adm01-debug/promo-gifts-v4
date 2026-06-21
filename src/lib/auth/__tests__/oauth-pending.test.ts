/**
 * Unit tests para `oauth-pending` — marcador de fluxo OAuth em andamento
 * persistido em sessionStorage para evitar flash de UI ao voltar de
 * /auth/callback ou de um cancelamento no provider.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  markOAuthPending,
  clearOAuthPending,
  readOAuthPending,
  OAUTH_PENDING_TTL_MS,
} from '../oauth-pending';

describe('oauth-pending', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('mark + read devolve provider e startedAt recentes', () => {
    const before = Date.now();
    markOAuthPending('google');
    const state = readOAuthPending();
    expect(state).not.toBeNull();
    expect(state!.provider).toBe('google');
    expect(state!.startedAt).toBeGreaterThanOrEqual(before);
    expect(state!.startedAt).toBeLessThanOrEqual(Date.now());
  });

  it('clear remove o marcador', () => {
    markOAuthPending('google');
    clearOAuthPending();
    expect(readOAuthPending()).toBeNull();
  });

  it('read devolve null quando vazio', () => {
    expect(readOAuthPending()).toBeNull();
  });

  it('read expira pending mais velho que TTL e limpa o storage', () => {
    markOAuthPending('google');
    const raw = JSON.parse(sessionStorage.getItem('__oauth_pending')!);
    // Força startedAt para o passado além do TTL.
    raw.startedAt = Date.now() - OAUTH_PENDING_TTL_MS - 1000;
    sessionStorage.setItem('__oauth_pending', JSON.stringify(raw));

    expect(readOAuthPending()).toBeNull();
    // Side-effect: storage foi limpo
    expect(sessionStorage.getItem('__oauth_pending')).toBeNull();
  });

  it('read descarta payload malformado', () => {
    sessionStorage.setItem('__oauth_pending', 'not-json{');
    expect(readOAuthPending()).toBeNull();
    sessionStorage.setItem('__oauth_pending', JSON.stringify({ foo: 'bar' }));
    expect(readOAuthPending()).toBeNull();
  });

  it('mark é idempotente — sobrescreve startedAt', async () => {
    markOAuthPending('google');
    const first = readOAuthPending()!.startedAt;
    await new Promise((r) => {
      setTimeout(r, 5);
    });
    markOAuthPending('google');
    const second = readOAuthPending()!.startedAt;
    expect(second).toBeGreaterThanOrEqual(first);
  });
});
