/**
 * safeAuthCall — 40 cenários unit + 10 integration-like (fuzz combinacional).
 * Invariante: nunca lança; sempre retorna SafeAuthResult com userMessage segura.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  safeAuthCall,
  __resetBreakers,
  type AuthErrorKind,
} from '@/lib/auth/safeAuthCall';
import {
  resetStructuredLoggerMock,
  findLoggerEventsByScope,
  structuredLoggerMockFactory,
} from '@/test/mockStructuredLogger';

vi.mock('@/lib/telemetry/structuredLogger', async () => {
  const mod = await import('@/test/mockStructuredLogger');
  return mod.structuredLoggerMockFactory();
});
// Referência para evitar warning de import não usado no factory tipado.
void structuredLoggerMockFactory;

const OK = { data: { user: { id: 'u1' } }, error: null };

function mkErr(status: number, message: string, name = 'AuthApiError') {
  return { data: null, error: { status, message, name } };
}

describe('safeAuthCall — sucesso e classificação', () => {
  beforeEach(() => { __resetBreakers(); resetStructuredLoggerMock(); });

  it('retorna kind=ok no primeiro sucesso', async () => {
    const r = await safeAuthCall(async () => OK, { op: 'signIn' });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.attempts).toBe(1);
  });

  it.each<[number, string, AuthErrorKind]>([
    [400, 'Invalid login credentials', 'credential'],
    [401, 'invalid_credentials', 'credential'],
    [401, 'Email not confirmed', 'credential'],
    [403, 'forbidden', 'credential'],
    [429, 'rate limit exceeded', 'ratelimit'],
    [500, 'internal server error', 'server'],
    [502, 'bad gateway', 'server'],
    [503, 'service unavailable', 'server'],
    [504, 'gateway timeout', 'server'],
  ])('classifica status=%s msg=%s como %s', async (status, msg, kind) => {
    const r = await safeAuthCall(async () => mkErr(status, msg), {
      op: 'signIn',
      maxRetries: 1,
    });
    expect(r.kind).toBe('err');
    if (r.kind === 'err') expect(r.errorKind).toBe(kind);
  });

  it('não retenta credential (retorna após 1 tentativa mesmo com maxRetries=3)', async () => {
    const call = vi.fn(async () => mkErr(401, 'Invalid login'));
    const r = await safeAuthCall(call, { op: 'signIn', maxRetries: 3 });
    expect(call).toHaveBeenCalledTimes(1);
    expect(r.attempts).toBe(1);
    expect(r.kind).toBe('err');
  });

  it('não retenta ratelimit', async () => {
    const call = vi.fn(async () => mkErr(429, 'rate limit'));
    const r = await safeAuthCall(call, { op: 'signIn', maxRetries: 3 });
    expect(call).toHaveBeenCalledTimes(1);
    if (r.kind === 'err') expect(r.errorKind).toBe('ratelimit');
  });

  it('retenta network e retorna ok na 2ª tentativa', async () => {
    let n = 0;
    const call = vi.fn(async () => {
      n++;
      if (n === 1) throw new TypeError('Failed to fetch');
      return OK;
    });
    const r = await safeAuthCall(call, { op: 'signIn', maxRetries: 3 });
    expect(call).toHaveBeenCalledTimes(2);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.attempts).toBe(2);
  });

  it('retenta server 500 até esgotar', async () => {
    const call = vi.fn(async () => mkErr(500, 'boom'));
    const r = await safeAuthCall(call, { op: 'signIn', maxRetries: 3 });
    expect(call).toHaveBeenCalledTimes(3);
    if (r.kind === 'err') expect(r.errorKind).toBe('server');
  });

  it('respeita AbortSignal externo já abortado', async () => {
    const ac = new AbortController();
    ac.abort();
    const call = vi.fn(async () => OK);
    const r = await safeAuthCall(call, {
      op: 'signIn',
      signal: ac.signal,
      maxRetries: 2,
    });
    expect(call).not.toHaveBeenCalled();
    if (r.kind === 'err') expect(r.errorKind).toBe('timeout');
  });

  it('timeout de tentativa dispara AbortError e classifica como timeout', async () => {
    const call = vi.fn(
      () => new Promise<{ data: null; error: null }>(() => {}), // nunca resolve
    );
    const r = await safeAuthCall(call, {
      op: 'signIn',
      timeoutMs: 20,
      maxRetries: 1,
    });
    if (r.kind === 'err') expect(r.errorKind).toBe('timeout');
    expect(r.elapsedMs).toBeGreaterThanOrEqual(20);
  }, 5_000);

  it('nunca lança exceção — resposta malformada vira unknown', async () => {
    // Simula lib devolvendo algo inesperado
    const call = vi.fn(async () => {
      throw { weird: true };
    });
    const r = await safeAuthCall(call as never, {
      op: 'signIn',
      maxRetries: 1,
    });
    expect(r.kind).toBe('err');
    if (r.kind === 'err') {
      expect(r.errorKind).toBe('unknown');
      expect(typeof r.userMessage).toBe('string');
      expect(r.userMessage.length).toBeGreaterThan(0);
    }
  });

  it('userMessage é sanitizada (não expõe stack) em não-dev', async () => {
    const call = vi.fn(async () =>
      mkErr(500, 'TypeError: Cannot read properties at http://x/foo.js:1:2'),
    );
    const r = await safeAuthCall(call, {
      op: 'signIn',
      maxRetries: 1,
      isDev: false,
    });
    if (r.kind === 'err') {
      expect(r.userMessage).not.toMatch(/TypeError/);
      expect(r.userMessage).not.toMatch(/http:\/\//);
    }
  });

  it('em dev retorna mensagem crua', async () => {
    const r = await safeAuthCall(async () => mkErr(500, 'DEV_RAW_MSG_XYZ'), {
      op: 'signIn',
      maxRetries: 1,
      isDev: true,
    });
    if (r.kind === 'err') expect(r.userMessage).toContain('DEV_RAW_MSG_XYZ');
  });

  it('emite structured log com scope auth.<op>', async () => {
    await safeAuthCall(async () => OK, { op: 'signUp' });
    const evs = findLoggerEventsByScope('auth.signUp');
    expect(evs.some((e) => e.event === 'signUp_ok')).toBe(true);
  });

  it('emite exhausted quando esgota retries', async () => {
    await safeAuthCall(async () => mkErr(500, 'x'), {
      op: 'refresh',
      maxRetries: 2,
    });
    const evs = findLoggerEventsByScope('auth.refresh');
    expect(evs.some((e) => e.event === 'refresh_exhausted')).toBe(true);
  });
});

describe('safeAuthCall — fuzz combinacional (40 cenários)', () => {
  beforeEach(() => { __resetBreakers(); resetStructuredLoggerMock(); });

  const errorMatrix: ReadonlyArray<[number, string]> = [
    [400, 'Invalid login credentials'],
    [401, 'Invalid credentials'],
    [401, 'Email not confirmed'],
    [403, 'forbidden'],
    [429, 'Too many requests'],
    [500, 'boom'],
    [502, 'bad gateway'],
    [503, 'service unavailable'],
    [504, 'timeout upstream'],
    [0, 'Failed to fetch'],
  ];

  it.each(errorMatrix)(
    'nunca lança para status=%s / msg=%s',
    async (status, msg) => {
      for (let i = 0; i < 4; i++) {
        const r = await safeAuthCall(
          async () =>
            status === 0
              ? Promise.reject(new TypeError(msg))
              : Promise.resolve(mkErr(status, msg)),
          { op: 'fuzz', maxRetries: 1 + (i % 2), timeoutMs: 500 },
        );
        expect(r.kind === 'ok' || r.kind === 'err').toBe(true);
        if (r.kind === 'err') {
          expect(typeof r.userMessage).toBe('string');
          expect(r.userMessage.length).toBeGreaterThan(0);
        }
      }
    },
  );
});
