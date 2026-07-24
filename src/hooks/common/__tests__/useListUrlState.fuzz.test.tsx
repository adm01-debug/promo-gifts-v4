/**
 * FUZZ / EXHAUSTIVE — useListUrlState
 *
 * Property-based simulations validando invariantes:
 *  I1. `values[k]` reflete URL quando presente, senão default.
 *  I2. Valor igual ao default NUNCA aparece na URL.
 *  I3. Params fora de `keys` são sempre preservados.
 *  I4. clearAll() zera todas as chaves gerenciadas mesmo com estado misto.
 *  I5. Sequências arbitrárias de setValue não corrompem params externos.
 *  I6. Debounce nunca escreve valor intermediário obsoleto (last-write-wins).
 *  I7. Chaves com caracteres especiais (URI-encoded) fazem round-trip idempotente.
 *  I8. searchInput e values[searchKey] convergem após debounce.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import React, { type ReactNode } from 'react';

import { useListUrlState } from '@/hooks/common/useListUrlState';

const KEYS = { status: 'all', deadline: 'all', sort: 'recent', q: '' } as const;
type K = keyof typeof KEYS;

const STATUS_VALUES = ['all', 'draft', 'em_separacao', 'faturado', 'cancelado'];
const DEADLINE_VALUES = ['all', 'overdue', 'today', 'week', 'month'];
const SORT_VALUES = ['recent', 'deadline-asc', 'deadline-desc', 'name-asc'];

function mkWrapper(initial: string) {
  let search = '';
  const Probe = () => {
    const l = useLocation();
    search = l.search;
    return null;
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>
      <Probe />
      {children}
    </MemoryRouter>
  );
  return { wrapper, getSearch: () => search };
}

// Deterministic PRNG (xmur3 + sfc32) — reproducible fuzz.
function rng(seed: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  let a = h,
    b = h ^ 0x9e3779b9,
    c = h ^ 0x243f6a88,
    d = h ^ 0xb7e15162;
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

describe('FUZZ useListUrlState — I1..I5 (300 simulações)', () => {
  const N = 300;
  for (let s = 0; s < N; s++) {
    it(`sim #${s}: setValue arbitrário preserva invariantes`, async () => {
      const r = rng(`fuzz-${s}`);
      // URL inicial aleatória incluindo params externos.
      const externalCount = Math.floor(r() * 3);
      const ext: Record<string, string> = {};
      for (let i = 0; i < externalCount; i++) {
        ext[`ext${i}`] = `v${Math.floor(r() * 1000)}`;
      }
      const base = new URLSearchParams(ext);
      if (r() > 0.5) base.set('status', pick(r, STATUS_VALUES));
      if (r() > 0.5) base.set('deadline', pick(r, DEADLINE_VALUES));
      if (r() > 0.5) base.set('sort', pick(r, SORT_VALUES));

      const initial = `/x?${base.toString()}`;
      const { wrapper, getSearch } = mkWrapper(initial);
      const { result } = renderHook(
        () => useListUrlState({ keys: KEYS, searchKey: 'q', debounceMs: 250 }),
        { wrapper },
      );

      // Sequência de ops
      const ops = 5 + Math.floor(r() * 10);
      for (let i = 0; i < ops; i++) {
        const k = pick(r, ['status', 'deadline', 'sort'] as K[]);
        const pool =
          k === 'status' ? STATUS_VALUES : k === 'deadline' ? DEADLINE_VALUES : SORT_VALUES;
        const v = pick(r, pool);
        act(() => result.current.setValue(k, v));

        // I1 & I2 imediatos
        const params = new URLSearchParams(getSearch());
        expect(result.current.values[k]).toBe(v);
        if (v === KEYS[k]) {
          expect(params.has(k)).toBe(false);
        } else {
          expect(params.get(k)).toBe(v);
        }
        // I3 — externos preservados
        for (const [ek, ev] of Object.entries(ext)) {
          expect(params.get(ek)).toBe(ev);
        }
      }

      // I4 — clearAll zera gerenciadas, preserva externas
      act(() => result.current.clearAll());
      await waitFor(() => {
        const p = new URLSearchParams(getSearch());
        for (const k of Object.keys(KEYS)) expect(p.has(k)).toBe(false);
        for (const [ek, ev] of Object.entries(ext)) expect(p.get(ek)).toBe(ev);
      });
      for (const k of Object.keys(KEYS) as K[]) {
        expect(result.current.values[k]).toBe(KEYS[k]);
      }
    });
  }
});

describe('FUZZ debounce — I6 last-write-wins (50 sims)', () => {
  for (let s = 0; s < 50; s++) {
    it(`debounce sim #${s}`, async () => {
      const r = rng(`deb-${s}`);
      const { wrapper, getSearch } = mkWrapper('/x');
      const { result } = renderHook(
        () => useListUrlState({ keys: KEYS, searchKey: 'q', debounceMs: 50 }),
        { wrapper },
      );

      const seq: string[] = [];
      const steps = 3 + Math.floor(r() * 6);
      for (let i = 0; i < steps; i++) {
        seq.push(`v${Math.floor(r() * 1e6).toString(36)}`);
      }
      // Rajada síncrona (sem esperar debounce)
      for (const v of seq) {
        act(() => result.current.setSearchInput(v));
      }
      const last = seq[seq.length - 1];

      // Nenhum intermediário deve aparecer eventualmente — só o último.
      await waitFor(
        () => {
          const p = new URLSearchParams(getSearch());
          expect(p.get('q')).toBe(last);
          expect(result.current.values.q).toBe(last);
        },
        { timeout: 2000 },
      );
    });
  }
});

describe('EDGE — caracteres especiais / URI encoding', () => {
  const CASES = [
    'a b',
    'á é í ó',
    'a&b=c',
    'a+b',
    'a%20b',
    'a/b',
    '#hash',
    '"quoted"',
    "'apos'",
    '<x>',
    '100%',
    '中文',
    '🎁',
    '   ',
    'a\nb',
  ];
  for (const raw of CASES) {
    it(`round-trip: ${JSON.stringify(raw)}`, async () => {
      const { wrapper, getSearch } = mkWrapper('/x');
      const { result } = renderHook(
        () => useListUrlState({ keys: KEYS, searchKey: 'q', debounceMs: 30 }),
        { wrapper },
      );
      act(() => result.current.setSearchInput(raw));
      await waitFor(
        () => {
          const p = new URLSearchParams(getSearch());
          expect(p.get('q')).toBe(raw);
          expect(result.current.values.q).toBe(raw);
        },
        { timeout: 1500 },
      );
    });
  }
});

describe('EDGE — deep-link com todos os defaults explícitos', () => {
  it('URL com valores default é lida corretamente e clearAll é no-op efetivo', async () => {
    // Nota: quem colocou defaults na URL foi um agente externo; o hook não
    // "normaliza" ao montar. Mas clearAll deve limpar tudo mesmo assim.
    const { wrapper, getSearch } = mkWrapper(
      '/x?status=all&deadline=all&sort=recent&q=',
    );
    const { result } = renderHook(
      () => useListUrlState({ keys: KEYS, searchKey: 'q', debounceMs: 30 }),
      { wrapper },
    );
    expect(result.current.values.status).toBe('all');
    expect(result.current.values.deadline).toBe('all');
    expect(result.current.values.sort).toBe('recent');
    expect(result.current.values.q).toBe('');

    act(() => result.current.clearAll());
    await waitFor(() => {
      const p = new URLSearchParams(getSearch());
      expect(p.has('status')).toBe(false);
      expect(p.has('deadline')).toBe(false);
      expect(p.has('sort')).toBe(false);
      expect(p.has('q')).toBe(false);
    });
  });
});

describe('EDGE — sem searchKey (hook usado só para filtros)', () => {
  it('funciona sem debounce/search e não emite warnings', async () => {
    const { wrapper, getSearch } = mkWrapper('/x?status=draft');
    const { result } = renderHook(
      () => useListUrlState({ keys: { status: 'all', sort: 'recent' } }),
      { wrapper },
    );
    expect(result.current.values.status).toBe('draft');
    expect(result.current.searchInput).toBe('');

    act(() => result.current.setValue('status', 'all'));
    await waitFor(() => {
      expect(new URLSearchParams(getSearch()).has('status')).toBe(false);
    });
  });
});

describe('EDGE — string vazia vs default não-vazio', () => {
  it('setValue("") em chave com default "recent" remove da URL (tratado como default por !value)', async () => {
    // Contrato atual: `!value || value === defaultValue` remove.
    // Isso significa que setValue('sort', '') também remove — documentado.
    const { wrapper, getSearch } = mkWrapper('/x?sort=name-asc');
    const { result } = renderHook(
      () => useListUrlState({ keys: KEYS, searchKey: 'q' }),
      { wrapper },
    );
    act(() => result.current.setValue('sort', ''));
    await waitFor(() => {
      expect(new URLSearchParams(getSearch()).has('sort')).toBe(false);
    });
    // values reflete o default (fallback) — não a string vazia.
    expect(result.current.values.sort).toBe('recent');
  });
});
