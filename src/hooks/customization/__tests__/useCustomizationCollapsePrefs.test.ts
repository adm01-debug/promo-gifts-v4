/**
 * Testes do hook useCustomizationCollapsePrefs.
 *
 * Cobrem:
 *  1. Migração automática das chaves antigas `customization-collapsed:<id>`
 *     ("1"/"0") para o novo mapa `customization-collapsed:v1`, sem perda
 *     de estado e removendo as chaves legadas.
 *  2. Debounce do upsert remoto: rajadas rápidas de toggle disparam **uma
 *     única** chamada de `supabase.upsert` após o intervalo.
 *  3. Analytics emitido de forma síncrona a cada toggle, mesmo durante o
 *     debounce do upsert.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  migrateLegacyCollapseKeys,
  useCustomizationCollapsePrefs,
} from '../useCustomizationCollapsePrefs';

const upsertMock = vi.fn(async () => ({ error: null }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { filter_states: {} } }) }),
      }),
      upsert: (...args: unknown[]) => upsertMock(...args),
    }),
  },
}));

describe('useCustomizationCollapsePrefs', () => {
  beforeEach(() => {
    window.localStorage.clear();
    upsertMock.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('migração de chaves legadas', () => {
    it('migra chaves antigas para o mapa v1 e remove as legadas', () => {
      window.localStorage.setItem('customization-collapsed:tec-A', '1');
      window.localStorage.setItem('customization-collapsed:tec-B', '0');
      window.localStorage.setItem('outro-app:foo', 'bar'); // intacto

      const merged = migrateLegacyCollapseKeys(window.localStorage);

      expect(merged).toEqual({ 'tec-A': true, 'tec-B': false });
      expect(window.localStorage.getItem('customization-collapsed:v1')).toBe(
        JSON.stringify({ 'tec-A': true, 'tec-B': false }),
      );
      expect(window.localStorage.getItem('customization-collapsed:tec-A')).toBeNull();
      expect(window.localStorage.getItem('customization-collapsed:tec-B')).toBeNull();
      expect(window.localStorage.getItem('outro-app:foo')).toBe('bar');
    });

    it('mantém valores do mapa v1 quando há conflito com chave legada', () => {
      window.localStorage.setItem(
        'customization-collapsed:v1',
        JSON.stringify({ 'tec-A': false }),
      );
      window.localStorage.setItem('customization-collapsed:tec-A', '1'); // legado conflitante
      window.localStorage.setItem('customization-collapsed:tec-C', '1');

      const merged = migrateLegacyCollapseKeys(window.localStorage);

      expect(merged).toEqual({ 'tec-A': false, 'tec-C': true });
    });

    it('é idempotente quando não há chaves legadas', () => {
      window.localStorage.setItem(
        'customization-collapsed:v1',
        JSON.stringify({ x: true }),
      );
      const merged = migrateLegacyCollapseKeys(window.localStorage);
      expect(merged).toEqual({ x: true });
    });

    it('é exposta na hidratação inicial do hook', () => {
      window.localStorage.setItem('customization-collapsed:tec-X', '1');
      const { result } = renderHook(() => useCustomizationCollapsePrefs('tec-X'));
      expect(result.current.collapsed).toBe(true);
      expect(window.localStorage.getItem('customization-collapsed:tec-X')).toBeNull();
    });
  });

  describe('debounce do upsert remoto', () => {
    it('agrupa toggles rápidos em uma única chamada de upsert', async () => {
      const { result } = renderHook(() => useCustomizationCollapsePrefs('tec-1'));

      act(() => {
        result.current.setCollapsed('tec-1', true);
        result.current.setCollapsed('tec-1', false);
        result.current.setCollapsed('tec-1', true);
        result.current.setCollapsed('tec-1', false);
      });

      // Antes do timer: nenhum upsert.
      expect(upsertMock).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(900);
      });

      expect(upsertMock).toHaveBeenCalledTimes(1);
      const payload = upsertMock.mock.calls[0][0] as { filter_states: Record<string, unknown> };
      expect(payload.filter_states).toMatchObject({
        __customization_collapse: { 'tec-1': false }, // último estado vence
      });
    });

    it('emite analytics imediatamente em cada toggle (independente do debounce)', () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const { result } = renderHook(() => useCustomizationCollapsePrefs('tec-9'));

      act(() => {
        result.current.setCollapsed('tec-9', true);
        result.current.setCollapsed('tec-9', false);
      });

      const events = infoSpy.mock.calls
        .map((c) => String(c[0]))
        .filter((s) => s.includes('panel_collapsed') || s.includes('panel_expanded'));
      expect(events.length).toBe(2);
      expect(upsertMock).not.toHaveBeenCalled();
      infoSpy.mockRestore();
    });
  });
});
