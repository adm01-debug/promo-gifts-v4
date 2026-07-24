import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBridgeMetrics } from '@/hooks/dev/useBridgeMetrics';
import * as bridgeMetricsLib from '@/lib/telemetry/bridgeCallMetrics';

vi.mock('@/lib/telemetry/bridgeCallMetrics', () => ({
  getBridgeSamples: vi.fn(() => []),
  subscribeBridgeCalls: vi.fn(() => () => {}),
  clearBridgeSamples: vi.fn(),
}));

vi.mock('@/lib/telemetry/longTaskWatchdog', () => ({
  getLongTaskEvents: vi.fn(() => []),
  subscribeLongTasks: vi.fn(() => () => {}),
}));

describe('useBridgeMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('deve inicializar com valores padrão', () => {
    const { result } = renderHook(() => useBridgeMetrics(true));
    expect(result.current.open).toBe(false);
  });

  it('deve permitir limpar amostras', () => {
    const { result } = renderHook(() => useBridgeMetrics(true));
    act(() => {
      result.current.clear();
    });
    expect(bridgeMetricsLib.clearBridgeSamples).toHaveBeenCalled();
  });
});
