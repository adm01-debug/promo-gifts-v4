import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBridgeStatusBanner } from '@/hooks/intelligence/useBridgeStatusBanner';
import { emitBridgeStatus } from '@/lib/external-db/bridge-status-events';
import * as bridgeStatusEvents from '@/lib/external-db/bridge-status-events';
import { toast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('useBridgeStatusBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should dismiss toasts when closeUnavailable is called', () => {
    const { result } = renderHook(() => useBridgeStatusBanner(true));

    // Simulate becoming unavailable
    act(() => {
      emitBridgeStatus({ type: 'unavailable', reason: 'Service down', attempts: 5 });
    });

    expect(result.current.unavailable).toBe(true);
    expect(toast.error).toHaveBeenCalled();

    // Call closeUnavailable
    act(() => {
      result.current.closeUnavailable();
    });

    expect(result.current.unavailable).toBe(false);
    // Should dismiss the unavailable toast
    expect(toast.dismiss).toHaveBeenCalledWith('bridge-unavailable');
  });

  it('should show "Conexão restabelecida" success toast only when transitioning from unavailable to recovered', () => {
    const { result } = renderHook(() => useBridgeStatusBanner(true));

    // Transition 1: Normal -> Recovered (should show "Conexão normalizada")
    act(() => {
      emitBridgeStatus({ type: 'recovered' });
    });

    expect(toast.success).toHaveBeenCalledWith('Conexão normalizada', expect.any(Object));
    vi.clearAllMocks();

    // Transition 2: Normal -> Unavailable -> Recovered (should show "Conexão restabelecida")
    act(() => {
      emitBridgeStatus({ type: 'unavailable', reason: 'Service down', attempts: 5 });
    });
    expect(result.current.unavailable).toBe(true);

    act(() => {
      emitBridgeStatus({ type: 'recovered' });
    });

    expect(result.current.unavailable).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('Conexão restabelecida', expect.objectContaining({
      id: 'bridge-unavailable'
    }));
  });

  it('should dismiss degraded toast when transitioning to unavailable', () => {
    renderHook(() => useBridgeStatusBanner(true));

    // Simulate degraded
    act(() => {
      emitBridgeStatus({ type: 'degraded', attempt: 1, maxAttempts: 3, delayMs: 1000, reason: 'Slow' });
    });
    expect(toast.loading).toHaveBeenCalled();

    // Transition to unavailable
    act(() => {
      emitBridgeStatus({ type: 'unavailable', reason: 'Service down', attempts: 3 });
    });

    // Should dismiss the degraded toast
    expect(toast.dismiss).toHaveBeenCalledWith('bridge-degraded');
    expect(toast.error).toHaveBeenCalled();
  });

  it('should not show degraded toast if not allowed', () => {
    renderHook(() => useBridgeStatusBanner(false));

    act(() => {
      emitBridgeStatus({ type: 'degraded', attempt: 1, maxAttempts: 3, delayMs: 1000, reason: 'Slow' });
    });

    expect(toast.loading).not.toHaveBeenCalled();
  });

  it('should unsubscribe from bridge status events and dismiss toasts when unmounted', () => {
    const unsubSpy = vi.fn();
    const subSpy = vi.spyOn(bridgeStatusEvents, 'onBridgeStatus').mockReturnValue(unsubSpy);
    
    const { unmount } = renderHook(() => useBridgeStatusBanner(true));
    
    expect(subSpy).toHaveBeenCalled();

    unmount();

    // Deve chamar o unsubscribe retornado pelo onBridgeStatus
    expect(unsubSpy).toHaveBeenCalled();
    // Deve limpar o toast de "degraded" (que é o temporário que pode vazar)
    expect(toast.dismiss).toHaveBeenCalledWith('bridge-degraded');
  });
});
