import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBridgeMetrics } from '@/hooks/dev/useBridgeMetrics';
import * as bridgeCallMetrics from '@/lib/telemetry/bridgeCallMetrics';
import * as longTaskWatchdog from '@/lib/telemetry/longTaskWatchdog';

// Mock do localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useBridgeMetrics Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should unsubscribe from telemetry when unmounted', () => {
    const unsubCallsSpy = vi.fn();
    const unsubTasksSpy = vi.fn();
    
    const subCallsSpy = vi.spyOn(bridgeCallMetrics, 'subscribeBridgeCalls').mockReturnValue(unsubCallsSpy);
    const subTasksSpy = vi.spyOn(longTaskWatchdog, 'subscribeLongTasks').mockReturnValue(unsubTasksSpy);

    const { unmount } = renderHook(() => useBridgeMetrics(true));

    expect(subCallsSpy).toHaveBeenCalled();
    expect(subTasksSpy).toHaveBeenCalled();

    unmount();
    
    expect(unsubCallsSpy).toHaveBeenCalled();
    expect(unsubTasksSpy).toHaveBeenCalled();
  });

  it('should remove keyboard event listener when unmounted', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useBridgeMetrics(true));

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    const handler = addSpy.mock.calls.find(call => call[0] === 'keydown')![1];

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', handler);
  });
});
