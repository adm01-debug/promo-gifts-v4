import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  DEFAULT_FUTURE_STOCK_PREFERENCE,
  FUTURE_STOCK_STORAGE_KEY,
  readFutureStockPreference,
  useFutureStockPreference,
  useFutureStockShortcut,
  writeFutureStockPreference,
} from '../useFutureStockPreference';

describe('useFutureStockPreference — persistência', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('retorna default quando storage está vazio', () => {
    expect(readFutureStockPreference()).toEqual(DEFAULT_FUTURE_STOCK_PREFERENCE);
  });

  it('persiste e relê preferência válida', () => {
    writeFutureStockPreference({ includeFutureStock: true, futureStockWindowDays: 30 });
    expect(readFutureStockPreference()).toEqual({
      includeFutureStock: true,
      futureStockWindowDays: 30,
    });
  });

  it('cai para default quando JSON está corrompido', () => {
    window.localStorage.setItem(FUTURE_STOCK_STORAGE_KEY, '{not json');
    expect(readFutureStockPreference()).toEqual(DEFAULT_FUTURE_STOCK_PREFERENCE);
  });

  it('sanitiza janela fora do conjunto [7,15,30]', () => {
    window.localStorage.setItem(
      FUTURE_STOCK_STORAGE_KEY,
      JSON.stringify({ includeFutureStock: true, futureStockWindowDays: 999 }),
    );
    expect(readFutureStockPreference()).toEqual({
      includeFutureStock: true,
      futureStockWindowDays: 15,
    });
  });

  it('hidrata uma vez e propaga mudanças subsequentes', () => {
    writeFutureStockPreference({ includeFutureStock: true, futureStockWindowDays: 7 });
    const onHydrate = vi.fn();
    const initial = { includeFutureStock: false as boolean, futureStockWindowDays: 15 as 7 | 15 | 30 };
    const { rerender } = renderHook(
      ({ pref }) => useFutureStockPreference(pref, onHydrate),
      { initialProps: { pref: initial } },
    );
    expect(onHydrate).toHaveBeenCalledWith({
      includeFutureStock: true,
      futureStockWindowDays: 7,
    });

    rerender({ pref: { includeFutureStock: true, futureStockWindowDays: 30 } });
    expect(JSON.parse(window.localStorage.getItem(FUTURE_STOCK_STORAGE_KEY) ?? '{}')).toEqual({
      includeFutureStock: true,
      futureStockWindowDays: 30,
    });
  });
});

describe('useFutureStockShortcut — atalho Shift+F', () => {
  it('dispara toggle no Shift+F', () => {
    const toggle = vi.fn();
    renderHook(() => useFutureStockShortcut(toggle));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', shiftKey: true }));
    });
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('ignora quando foco está em <input>', () => {
    const toggle = vi.fn();
    renderHook(() => useFutureStockShortcut(toggle));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F', shiftKey: true, bubbles: true }),
      );
    });
    expect(toggle).not.toHaveBeenCalled();
    input.remove();
  });

  it('ignora combinações com Ctrl/Meta/Alt', () => {
    const toggle = vi.fn();
    renderHook(() => useFutureStockShortcut(toggle));
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F', shiftKey: true, ctrlKey: true }),
      );
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F', shiftKey: true, metaKey: true }),
      );
    });
    expect(toggle).not.toHaveBeenCalled();
  });

  it('não registra listener quando enabled=false', () => {
    const toggle = vi.fn();
    renderHook(() => useFutureStockShortcut(toggle, false));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', shiftKey: true }));
    });
    expect(toggle).not.toHaveBeenCalled();
  });
});
