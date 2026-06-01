import { describe, it, expect, beforeEach, vi } from 'vitest';

const loggerWarnMock = vi.fn();
vi.mock('@/lib/logger', () => ({
  logger: { warn: (...args: unknown[]) => loggerWarnMock(...args) },
}));

// Mock supabase client:
// - auth.getSession → authSignal
// - from().select().eq().limit() → restSignal (checkRest usa supabase.from, não fetch)
const getSessionMock = vi.fn();
const limitMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: () => getSessionMock() },
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: () => limitMock(),
        }),
      }),
    }),
  },
}));

const pingHealthMock = vi.fn();
vi.mock('@/lib/external-db/health-check', () => ({
  pingHealth: (...args: unknown[]) => pingHealthMock(...args),
}));

import {
  probeCloudStatus,
  invalidateCloudStatus,
  ensureCloudReady,
  CloudNotReadyError,
} from '@/lib/cloud-status';

beforeEach(() => {
  invalidateCloudStatus();
  getSessionMock.mockReset();
  pingHealthMock.mockReset();
  limitMock.mockReset();
  loggerWarnMock.mockReset();
  localStorage.clear();
  // Default: REST signal healthy
  limitMock.mockResolvedValue({ data: [{ value: 'false' }], error: null });
});

describe('cloud-status', () => {
  it('returns healthy when all 3 signals pass with low latency', async () => {
    getSessionMock.mockResolvedValue({ error: null });
    pingHealthMock.mockResolvedValue({ ok: true, ms: 100 });
    limitMock.mockResolvedValue({ data: [], error: null }); // REST OK

    const snap = await probeCloudStatus(true);
    expect(snap.status).toBe('healthy');
  });

  it('returns warming when 2 of 3 signals pass', async () => {
    getSessionMock.mockResolvedValue({ error: null });
    pingHealthMock.mockResolvedValue({ ok: false, ms: 2500, error: 'boom' }); // bridge FAIL
    limitMock.mockResolvedValue({ data: [], error: null }); // REST OK

    const snap = await probeCloudStatus(true);
    expect(snap.status).toBe('warming');
  });

  it('returns degraded when only 1 of 3 signals passes', async () => {
    getSessionMock.mockResolvedValue({ error: null }); // auth OK
    pingHealthMock.mockResolvedValue({ ok: false, ms: 0, error: 'x' }); // bridge FAIL
    limitMock.mockResolvedValue({ error: { message: 'net' } }); // REST FAIL

    const snap = await probeCloudStatus(true);
    expect(snap.status).toBe('degraded');
  });

  it('returns down when all signals fail twice consecutively', async () => {
    getSessionMock.mockResolvedValue({ error: new Error('x') });
    pingHealthMock.mockResolvedValue({ ok: false, ms: 0, error: 'x' });
    limitMock.mockResolvedValue({ error: { message: 'net' } });

    // FAILURE_THRESHOLD=2: primeira falha total retorna 'degraded'
    await probeCloudStatus(true);
    invalidateCloudStatus();
    // segunda falha consecutiva atinge o threshold → 'down'
    const snap = await probeCloudStatus(true);
    expect(snap.status).toBe('down');
  });

  it('caches result for 15s (no extra signal calls)', async () => {
    getSessionMock.mockResolvedValue({ error: null });
    pingHealthMock.mockResolvedValue({ ok: true, ms: 100 });
    limitMock.mockResolvedValue({ data: [], error: null });

    await probeCloudStatus(true);
    await probeCloudStatus(false);
    await probeCloudStatus(false);

    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(pingHealthMock).toHaveBeenCalledTimes(1);
    // limitMock (REST) should also be called once (cached)
    expect(limitMock).toHaveBeenCalledTimes(1);
  });

  it('does not fail probe when history persistence throws', async () => {
    getSessionMock.mockResolvedValue({ error: null });
    pingHealthMock.mockResolvedValue({ ok: true, ms: 100 });
    limitMock.mockResolvedValue({ data: [], error: null });

    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });

    const snap = await probeCloudStatus(true);

    expect(snap.status).toBe('healthy');
    expect(snap.signals.auth.ok).toBe(true);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      '[CloudStatus] failed to persist status history',
      expect.objectContaining({
        HISTORY_KEY: 'supabase_health_history',
        error: 'quota exceeded',
      }),
    );

    setItemSpy.mockRestore();
  });

  it('ensureCloudReady throws CloudNotReadyError when persistently degraded', async () => {
    getSessionMock.mockResolvedValue({ error: new Error('x') });
    pingHealthMock.mockResolvedValue({ ok: false, ms: 0, error: 'x' });
    limitMock.mockResolvedValue({ error: { message: 'net' } });

    await expect(ensureCloudReady(500, false)).rejects.toBeInstanceOf(CloudNotReadyError);
  });

  it('ensureCloudReady resolves when status is warming and acceptWarming=true', async () => {
    getSessionMock.mockResolvedValue({ error: null });
    pingHealthMock.mockResolvedValue({ ok: false, ms: 0, error: 'x' }); // bridge FAIL
    limitMock.mockResolvedValue({ data: [], error: null }); // REST OK

    const snap = await ensureCloudReady(2000, true);
    expect(snap.status).toBe('warming');
  });
});
