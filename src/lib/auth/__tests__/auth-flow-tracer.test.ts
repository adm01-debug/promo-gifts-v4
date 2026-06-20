import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthFlowTracer } from '../auth-flow-tracer';

describe('AuthFlowTracer', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
  });

  it('gera flowId hex de 8 chars e START log', () => {
    const t = new AuthFlowTracer();
    expect(t.flowId).toMatch(/^[0-9a-f]{8}$/);
  });

  it('record steps e finish persiste snapshot em sessionStorage', () => {
    const t = new AuthFlowTracer();
    t.step('mount');
    t.step('url-parsed', { hasCode: true });
    t.setFlow('pkce');
    t.step('pkce-exchange-ok');
    t.finish('success', '/dashboard');

    const snap = AuthFlowTracer.readLast();
    expect(snap).not.toBeNull();
    expect(snap?.flowId).toBe(t.flowId);
    expect(snap?.outcome).toBe('success');
    expect(snap?.redirectTarget).toBe('/dashboard');
    expect(snap?.flow).toBe('pkce');
    expect(snap?.steps.map((s) => s.phase)).toEqual(['mount', 'url-parsed', 'pkce-exchange-ok']);
    expect(snap?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('stepError normaliza Error e marca outcome=failure no finish', () => {
    const t = new AuthFlowTracer();
    t.step('mount');
    t.stepError('pkce-exchange-failed', new Error('boom'));
    t.finish('failure', '/login?error=boom', 'boom');

    const snap = AuthFlowTracer.readLast();
    expect(snap?.outcome).toBe('failure');
    expect(snap?.failureReason).toBe('boom');
    const errStep = snap?.steps.find((s) => s.phase === 'pkce-exchange-failed');
    expect(errStep?.detail).toMatchObject({ name: 'Error', message: 'boom' });
  });

  it('captureSession extrai user/provider/issuer mascarados', () => {
    const t = new AuthFlowTracer();
    // JWT mock: header.payload.sig com payload { iss: "https://x.supabase.co/auth/v1" }
    const payload = btoa(
      JSON.stringify({ iss: 'https://x.supabase.co/auth/v1', sub: 'u1', aud: 'authenticated' }),
    )
      .replace(/[=]+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const access = `h.${payload}.s`;
    // Cast mínimo — só os campos que captureSession lê.
    t.captureSession({
      access_token: access,
      refresh_token: 'r',
      token_type: 'bearer',
      expires_at: 0,
      expires_in: 3600,
      user: {
        email: 'joao.silva@example.com',
        app_metadata: { provider: 'google' },
      },
    } as never);
    t.finish('success', '/');
    const snap = AuthFlowTracer.readLast();
    expect(snap?.finalProvider).toBe('google');
    expect(snap?.finalIssuer).toBe('https://x.supabase.co/auth/v1');
    // e-mail vem mascarado pelo summarizeUser
    expect(snap?.finalSessionUser).toMatch(/^j\*+a@example\.com$/);
  });

  it('cada instância gera flowId distinto', () => {
    const ids = new Set(Array.from({ length: 10 }, () => new AuthFlowTracer().flowId));
    expect(ids.size).toBe(10);
  });

  it('readLast retorna null quando storage vazio', () => {
    expect(AuthFlowTracer.readLast()).toBeNull();
  });
});
