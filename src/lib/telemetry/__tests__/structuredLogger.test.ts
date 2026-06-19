import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClientLogger } from '../structuredLogger';
import { captureException } from '@/lib/sentry';

// Mock Sentry
vi.mock('@/lib/sentry', () => ({
  captureException: vi.fn(),
}));

// Mock requestId
vi.mock('../requestId', () => ({
  newRequestId: () => 'test-request-id',
  REQUEST_ID_HEADER: 'X-Request-Id',
}));

describe('structuredLogger.ts', () => {
  const consoleSpy = {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    info: vi.spyOn(console, 'info').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a logger with a scope and request id', () => {
    const log = createClientLogger('test.scope');
    expect(log.scope).toBe('test.scope');
    expect(log.requestId).toBe('test-request-id');
  });

  it('should provide headers with the request id', () => {
    const log = createClientLogger('test.scope');
    expect(log.headers()).toEqual({ 'X-Request-Id': 'test-request-id' });
  });

  it('should log info messages to console.info in DEV (PROD routes via warn — esbuild strips info)', () => {
    const log = createClientLogger('test.scope');
    log.info('test_event', { key: 'value' });

    // Vitest runs with import.meta.env.DEV=true → DEV branch → console.info.
    // In PROD the esbuild.pure config strips console.log/info/debug, so the PROD
    // branch routes info through console.warn to reach log collectors.
    expect(consoleSpy.info).toHaveBeenCalled();
  });

  it('should forward errors to Sentry', () => {
    const log = createClientLogger('test.scope');
    const testError = new Error('Database connection failed');
    log.error('db_error', { err: testError, some: 'context' });

    expect(captureException).toHaveBeenCalledWith(
      testError,
      expect.objectContaining({
        tags: expect.objectContaining({
          scope: 'test.scope',
          event: 'db_error',
          request_id: 'test-request-id',
        }),
      }),
    );
    expect(consoleSpy.error).toHaveBeenCalled();
  });

  it('should serialize non-Error objects passed as "err" or "error"', () => {
    const log = createClientLogger('test.scope');
    log.error('generic_error', { err: 'something went wrong' });

    expect(captureException).toHaveBeenCalled();
    const lastCall = vi.mocked(captureException).mock.calls[0];
    // If not an Error, it creates one
    expect(lastCall[0]).toBeInstanceOf(Error);
    expect(lastCall[0].message).toBe('test.scope.generic_error');
  });

  it('should create child loggers with appended scopes', () => {
    const log = createClientLogger('parent');
    const child = log.child('child', { extra: 'data' });

    expect(child.scope).toBe('parent.child');
    expect(child.requestId).toBe('test-request-id'); // Same request ID

    child.info('event');
    expect(consoleSpy.info).toHaveBeenCalled();
    const payload = consoleSpy.info.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.scope).toBe('parent.child');
    expect(payload.extra).toBe('data');
  });

  it('should use provided request ID if passed in options', () => {
    const log = createClientLogger('test', { requestId: 'custom-id' });
    expect(log.requestId).toBe('custom-id');
    expect(log.headers()).toEqual({ 'X-Request-Id': 'custom-id' });
  });
});
