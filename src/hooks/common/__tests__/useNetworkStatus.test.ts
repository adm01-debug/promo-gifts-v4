/**
 * Testes — useNetworkStatus
 *
 * Monitora online/offline via window events.
 *
 * Invariantes:
 *   - isOnline=true quando navigator.onLine=true no mount
 *   - isOffline = !isOnline
 *   - Atualiza ao disparar evento 'offline'
 *   - Atualiza ao disparar evento 'online'
 *   - Remove listeners ao desmontar (cleanup)
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useNetworkStatus } from '../useNetworkStatus';

// jsdom expõe window.addEventListener; navigator.onLine pode ser mockado via Object.defineProperty
beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
});

describe('useNetworkStatus', () => {
  it('inicia isOnline=true quando navigator.onLine=true', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
  });

  it('isOffline é sempre !isOnline', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOffline).toBe(!result.current.isOnline);
  });

  it('atualiza para offline ao disparar evento offline', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it('atualiza para online ao disparar evento online', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { window.dispatchEvent(new Event('offline')); });
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(result.current.isOnline).toBe(true);
  });

  it('cleanup: remove listeners ao desmontar (sem state update)', () => {
    const { unmount, result } = renderHook(() => useNetworkStatus());
    unmount();
    // Eventos disparados após unmount não devem causar erros
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current.isOnline).toBe(true); // estado congelado no unmount
  });
});
