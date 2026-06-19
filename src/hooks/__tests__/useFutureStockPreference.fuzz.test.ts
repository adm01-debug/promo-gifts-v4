/**
 * Fuzz/property-based exaustivo para useFutureStockPreference + shortcut.
 * Roda centenas de simulações cobrindo: payloads malformados, RNG,
 * race conditions de hidratação, atalhos com targets variados,
 * mudanças rápidas de janela, e robustez contra storage quebrado.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  DEFAULT_FUTURE_STOCK_PREFERENCE,
  FUTURE_STOCK_STORAGE_KEY,
  FUTURE_STOCK_WINDOWS,
  readFutureStockPreference,
  writeFutureStockPreference,
  useFutureStockPreference,
  useFutureStockShortcut,
  type FutureStockPreference,
} from '../useFutureStockPreference';

// PRNG determinístico (mulberry32) para reprodutibilidade
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = Number(process.env.FUTURE_STOCK_FUZZ_SEED ?? 0xc0ffee);
const RUNS = Number(process.env.FUTURE_STOCK_FUZZ_RUNS ?? 300);

describe(`useFutureStockPreference — fuzz exaustivo (seed=${SEED}, runs=${RUNS})`, () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('readFutureStockPreference NUNCA quebra em payloads aleatórios', () => {
    const r = rng(SEED);
    const malformed = [
      '',
      'null',
      'undefined',
      '{}',
      '[]',
      '{"a":1}',
      '{"includeFutureStock":"sim"}',
      '{"futureStockWindowDays":"15"}',
      '{"futureStockWindowDays":null}',
      '{"includeFutureStock":1,"futureStockWindowDays":7}',
      '{"includeFutureStock":true,"futureStockWindowDays":-1}',
      '{"includeFutureStock":true,"futureStockWindowDays":0}',
      '{"includeFutureStock":true,"futureStockWindowDays":3.14}',
      '{"includeFutureStock":true,"futureStockWindowDays":1e308}',
      '{"includeFutureStock":true,"futureStockWindowDays":NaN}',
      '{"includeFutureStock":true,"futureStockWindowDays":"30"}',
      '{not-json',
      '{"x":',
      '\u0000',
      '🔥',
    ];
    for (const payload of malformed) {
      window.localStorage.setItem(FUTURE_STOCK_STORAGE_KEY, payload);
      const pref = readFutureStockPreference();
      expect(typeof pref.includeFutureStock).toBe('boolean');
      expect(FUTURE_STOCK_WINDOWS).toContain(pref.futureStockWindowDays);
    }
    // payloads pseudo-aleatórios
    for (let i = 0; i < RUNS; i++) {
      const len = Math.floor(r() * 64);
      let s = '';
      for (let j = 0; j < len; j++) s += String.fromCharCode(Math.floor(r() * 0xffff));
      window.localStorage.setItem(FUTURE_STOCK_STORAGE_KEY, s);
      const pref = readFutureStockPreference();
      expect(FUTURE_STOCK_WINDOWS).toContain(pref.futureStockWindowDays);
      expect(typeof pref.includeFutureStock).toBe('boolean');
    }
  });

  it('write→read é idempotente para todas combinações válidas', () => {
    for (const include of [false, true]) {
      for (const win of FUTURE_STOCK_WINDOWS) {
        const pref: FutureStockPreference = {
          includeFutureStock: include,
          futureStockWindowDays: win,
        };
        writeFutureStockPreference(pref);
        expect(readFutureStockPreference()).toEqual(pref);
      }
    }
  });

  it('write não lança quando localStorage.setItem dispara (quota)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() =>
      writeFutureStockPreference({ includeFutureStock: true, futureStockWindowDays: 7 }),
    ).not.toThrow();
    spy.mockRestore();
  });

  it('read não lança quando localStorage.getItem dispara', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readFutureStockPreference()).toEqual(DEFAULT_FUTURE_STOCK_PREFERENCE);
    spy.mockRestore();
  });

  it('hook persiste centenas de transições aleatórias', () => {
    const r = rng(SEED ^ 0xa5a5);
    let current: FutureStockPreference = { ...DEFAULT_FUTURE_STOCK_PREFERENCE };
    const onHydrate = vi.fn();
    const { rerender } = renderHook(({ pref }) => useFutureStockPreference(pref, onHydrate), {
      initialProps: { pref: current },
    });
    for (let i = 0; i < RUNS; i++) {
      const include = r() > 0.5;
      const win = FUTURE_STOCK_WINDOWS[Math.floor(r() * FUTURE_STOCK_WINDOWS.length)];
      current = { includeFutureStock: include, futureStockWindowDays: win };
      rerender({ pref: current });
      const stored = readFutureStockPreference();
      expect(stored).toEqual(current);
    }
  });

  it('hidratação só ocorre uma vez mesmo com múltiplos rerenders antes do effect', () => {
    writeFutureStockPreference({ includeFutureStock: true, futureStockWindowDays: 30 });
    const onHydrate = vi.fn();
    const initial: FutureStockPreference = { includeFutureStock: false, futureStockWindowDays: 15 };
    const { rerender } = renderHook(({ pref }) => useFutureStockPreference(pref, onHydrate), {
      initialProps: { pref: initial },
    });
    rerender({ pref: initial });
    rerender({ pref: initial });
    rerender({ pref: initial });
    expect(onHydrate).toHaveBeenCalledTimes(1);
  });

  it('não chama onHydrate quando storage já bate com o estado atual', () => {
    writeFutureStockPreference({ includeFutureStock: false, futureStockWindowDays: 15 });
    const onHydrate = vi.fn();
    renderHook(() =>
      useFutureStockPreference({ includeFutureStock: false, futureStockWindowDays: 15 }, onHydrate),
    );
    expect(onHydrate).not.toHaveBeenCalled();
  });
});

describe(`useFutureStockShortcut — fuzz de teclas/targets (seed=${SEED})`, () => {
  let toggle: () => void;
  beforeEach(() => {
    toggle = vi.fn();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ignora qualquer tecla diferente de F com Shift', () => {
    renderHook(() => useFutureStockShortcut(toggle));
    const keys = ['a', 'B', 'Enter', 'Escape', 'Tab', '1', ' ', 'ArrowUp', 'g', 'G', 'Shift'];
    for (const key of keys) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: true }));
      });
    }
    expect(toggle).not.toHaveBeenCalled();
  });

  it('ignora F sem Shift', () => {
    renderHook(() => useFutureStockShortcut(toggle));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F' }));
    });
    expect(toggle).not.toHaveBeenCalled();
  });

  it.each(['INPUT', 'TEXTAREA', 'SELECT'])('ignora quando target=%s', (tag) => {
    renderHook(() => useFutureStockShortcut(toggle));
    const el = document.createElement(tag.toLowerCase());
    document.body.appendChild(el);
    el.focus();
    act(() => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', shiftKey: true, bubbles: true }));
    });
    expect(toggle).not.toHaveBeenCalled();
  });

  it('ignora quando contentEditable', () => {
    renderHook(() => useFutureStockShortcut(toggle));
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);
    div.focus();
    act(() => {
      div.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', shiftKey: true, bubbles: true }));
    });
    expect(toggle).not.toHaveBeenCalled();
  });

  it('dispara consistentemente em N rajadas com toggle atualizado (sem stale closure)', () => {
    let counter = 0;
    const { rerender } = renderHook(({ cb }) => useFutureStockShortcut(cb), {
      initialProps: {
        cb: () => {
          counter += 1;
        },
      },
    });
    for (let i = 0; i < 50; i++) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', shiftKey: true }));
      });
    }
    expect(counter).toBe(50);

    // troca callback — deve refletir sem perder eventos
    rerender({
      cb: () => {
        counter += 10;
      },
    });
    for (let i = 0; i < 5; i++) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', shiftKey: true }));
      });
    }
    expect(counter).toBe(50 + 50);
  });

  it('cleanup remove listener (toggle entre enabled true→false)', () => {
    const { rerender } = renderHook(({ on }) => useFutureStockShortcut(toggle, on), {
      initialProps: { on: true },
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', shiftKey: true }));
    });
    expect(toggle).toHaveBeenCalledTimes(1);
    rerender({ on: false });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', shiftKey: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', shiftKey: true }));
    });
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('combinações fuzz de modificadores — só Shift puro aciona', () => {
    const r = rng(SEED ^ 0x1234);
    renderHook(() => useFutureStockShortcut(toggle));
    let expected = 0;
    for (let i = 0; i < RUNS; i++) {
      const shiftKey = r() > 0.3;
      const ctrlKey = r() > 0.7;
      const metaKey = r() > 0.8;
      const altKey = r() > 0.8;
      const key = r() > 0.5 ? 'F' : 'f';
      const isFKey = key === 'F' || key === 'f';
      const shouldFire = shiftKey && !ctrlKey && !metaKey && !altKey && isFKey;
      if (shouldFire) expected++;
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key, shiftKey, ctrlKey, metaKey, altKey }),
        );
      });
    }
    expect(toggle).toHaveBeenCalledTimes(expected);
  });
});
