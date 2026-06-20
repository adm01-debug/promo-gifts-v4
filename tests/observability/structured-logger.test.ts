import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do Sentry para evitar import real
vi.mock('@/lib/sentry', () => ({ captureException: vi.fn() }));

import { createClientLogger } from '@/lib/telemetry/structuredLogger';
import { captureException } from '@/lib/sentry';

describe('structuredLogger (client)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emite payload JSON com campos canônicos', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const log = createClientLogger('test.scope', { requestId: 'rid-123' });
    log.info('hello', { foo: 'bar' });

    expect(spy).toHaveBeenCalledOnce();
    const arg = spy.mock.calls[0][0];
    // Em DEV o primeiro arg é o tag, em PROD é o JSON. Aceita ambos.
    const payloadObj =
      typeof arg === 'string' && arg.startsWith('{')
        ? JSON.parse(arg)
        : (spy.mock.calls[0][1] as Record<string, unknown>);

    expect(payloadObj).toMatchObject({
      level: 'info',
      scope: 'test.scope',
      request_id: 'rid-123',
      event: 'hello',
      foo: 'bar',
    });
    expect(payloadObj.ts).toBeDefined();
    spy.mockRestore();
  });

  it('encaminha erros para o Sentry com tag request_id', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createClientLogger('auth.signIn', { requestId: 'rid-err' });
    const err = new Error('boom');
    log.error('failed', { err });

    expect(captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        tags: expect.objectContaining({ scope: 'auth.signIn', event: 'failed', request_id: 'rid-err' }),
      }),
    );
  });

  it('headers() retorna X-Request-Id propagável', () => {
    const log = createClientLogger('x', { requestId: 'rid-h' });
    expect(log.headers()).toEqual({ 'X-Request-Id': 'rid-h' });
  });

  it('child preserva request_id e prefixa scope', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = createClientLogger('parent', { requestId: 'rid-c' });
    const child = log.child('sub');
    expect(child.requestId).toBe('rid-c');
    expect(child.scope).toBe('parent.sub');
  });
});
