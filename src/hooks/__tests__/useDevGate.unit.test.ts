/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDevGate } from '@/hooks/admin/useDevGate';
import { useAuth } from '@/contexts/AuthContext';
import { devInfraGate } from '@/lib/system/dev-gate/DevInfraGate';

// Mock do AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('useDevGate Hook — Unit Tests', () => {
  it('retorna isAllowed: false quando está carregando (isLoading: true)', () => {
    vi.mocked(useAuth).mockReturnValue({
      roles: ['dev'],
      isDev: true,
      isLoading: true,
    } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useDevGate());
    expect(result.current.isAllowed).toBe(false);
  });

  it('retorna isAllowed: true quando montado e autorizado', () => {
    vi.mocked(useAuth).mockReturnValue({
      roles: ['dev'],
      isDev: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useDevGate());
    expect(result.current.isAllowed).toBe(true);
    expect(result.current.isDev).toBe(true);
  });

  it('reage a mudanças no devInfraGate store', async () => {
    vi.mocked(useAuth).mockReturnValue({
      roles: ['dev'],
      isDev: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useDevGate());
    expect(result.current.isAllowed).toBe(true);

    // Mock do retorno da store
    const spy = vi.spyOn(devInfraGate, 'shouldShow').mockReturnValue(false);

    vi.useFakeTimers();
    await act(async () => {
      devInfraGate.invalidateCache();
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isAllowed).toBe(false);

    spy.mockRestore();
    vi.useRealTimers();
  });
});
