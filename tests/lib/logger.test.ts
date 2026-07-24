import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export all log methods', async () => {
    const { logger } = await import('@/lib/logger');
    expect(logger.log).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  it('logger.error should always log (even in production)', async () => {
    const { logger } = await import('@/lib/logger');
    logger.error('test error');
    // Logger outputs structured JSON via console.error
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/"level":"error"/)
    );
    const [jsonStr] = (console.error as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = JSON.parse(jsonStr as string);
    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('test error');
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('logger methods should accept multiple arguments', async () => {
    const { logger } = await import('@/lib/logger');
    logger.error('msg', { data: 1 }, [1, 2]);
    expect(console.error).toHaveBeenCalled();
    const [jsonStr] = (console.error as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = JSON.parse(jsonStr as string);
    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('msg');
    // Multiple extra args → extractData returns { details: [...] } → stored under data
    expect(parsed.data).toBeDefined();
    expect(parsed.data.details).toEqual([{ data: 1 }, [1, 2]]);
  });
});
