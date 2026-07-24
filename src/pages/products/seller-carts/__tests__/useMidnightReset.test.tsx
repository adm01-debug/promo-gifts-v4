/**
 * Testes do hook `useMidnightReset` — dispara callback quando a data local muda.
 *
 * Estratégia: usamos fake timers + um `nowProvider` mutável para simular o
 * avanço do relógio sem esperar 24h reais.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMidnightReset } from '../useMidnightReset';

describe('useMidnightReset', () => {
  let currentNow: Date;
  const nowProvider = () => currentNow;

  beforeEach(() => {
    vi.useFakeTimers();
    currentNow = new Date(2026, 6, 10, 23, 0, 0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não dispara callback na montagem inicial (sem mudança de dia)', () => {
    const onDayChange = vi.fn();
    renderHook(() => useMidnightReset(onDayChange, { nowProvider }));
    expect(onDayChange).not.toHaveBeenCalled();
  });

  it('dispara callback quando o clock avança para o dia seguinte', () => {
    const onDayChange = vi.fn();
    renderHook(() => useMidnightReset(onDayChange, { nowProvider }));

    // Avança 1h1min → passa da meia-noite local
    act(() => {
      currentNow = new Date(2026, 6, 11, 0, 1, 0);
      // Avança timers para disparar o setTimeout agendado.
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    });

    expect(onDayChange).toHaveBeenCalledWith('2026-07-11');
  });

  it('dispara ao voltar visibilidade (visibilitychange) se o dia mudou', () => {
    const onDayChange = vi.fn();
    renderHook(() => useMidnightReset(onDayChange, { nowProvider }));

    // Simula usuário saindo → aba oculta (sem timer disparar).
    // Depois volta e o clock avançou para o dia seguinte.
    currentNow = new Date(2026, 6, 11, 8, 0, 0);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(onDayChange).toHaveBeenCalledWith('2026-07-11');
  });

  it('não dispara callback duas vezes para o mesmo dia', () => {
    const onDayChange = vi.fn();
    renderHook(() => useMidnightReset(onDayChange, { nowProvider }));

    currentNow = new Date(2026, 6, 11, 0, 5, 0);
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    });
    // Novo evento visibilitychange no MESMO dia — não deve emitir de novo.
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(onDayChange).toHaveBeenCalledTimes(1);
  });

  it('não dispara se enabled=false (ex.: uid ainda não carregou)', () => {
    const onDayChange = vi.fn();
    renderHook(() => useMidnightReset(onDayChange, { enabled: false, nowProvider }));

    currentNow = new Date(2026, 6, 11, 12, 0, 0);
    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(onDayChange).not.toHaveBeenCalled();
  });

  it('erro dentro do callback do consumidor não propaga', () => {
    const onDayChange = vi.fn(() => {
      throw new Error('boom');
    });
    renderHook(() => useMidnightReset(onDayChange, { nowProvider }));

    currentNow = new Date(2026, 6, 11, 0, 5, 0);
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(2 * 60 * 60 * 1000);
      });
    }).not.toThrow();

    expect(onDayChange).toHaveBeenCalled();
  });

  it('cleanup no unmount remove listeners e timer', () => {
    const onDayChange = vi.fn();
    const { unmount } = renderHook(() =>
      useMidnightReset(onDayChange, { nowProvider }),
    );
    unmount();

    // Após unmount, mesmo mudando o dia, callback não é chamado.
    currentNow = new Date(2026, 6, 11, 12, 0, 0);
    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });

    expect(onDayChange).not.toHaveBeenCalled();
  });
});
