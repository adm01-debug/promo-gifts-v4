/**
 * Bateria EXAUSTIVA — property-based + fuzz + boundary sweep + stress multi-item.
 *
 * Cobre a lógica pura (`normalizeQty`) e o comportamento observável do
 * `<PopoverQtyInput />` sob centenas de simulações determinísticas. Se algo
 * regredir na sanitização, clamp, feedback ARIA, foco pós-Esc ou isolamento
 * entre itens, uma destas simulações quebra e aponta o cenário exato.
 *
 * Regras cobertas:
 *  1. normalizeQty é IDEMPOTENTE: normalize(String(normalize(x))) === normalize(x)
 *     (quando x é normalizável).
 *  2. normalizeQty ∈ [MIN_QTY, MAX_QTY] ou null.
 *  3. Sanitização preserva a MESMA sequência de dígitos que uma regex /[^0-9]/g.
 *  4. Enter em valor válido → commit + Total recalcula + feedback volta a idle.
 *  5. Esc → reverte + MANTÉM foco no input + limpa feedback.
 *  6. Vazio + commit → onCommit NÃO é chamado + aria-invalid=true.
 *  7. Clamp: qualquer entrada com digitsOnly > MAX_QTY → commit MAX_QTY exato.
 *  8. onCommit não é chamado quando o valor normalizado é igual ao atual.
 *  9. Isolamento: 20 inputs em paralelo — feedback de um NÃO vaza para o outro.
 * 10. Feedback ARIA (`aria-describedby`, `role=status`, `aria-live=polite`,
 *     `aria-invalid`) é coerente com `data-feedback`.
 * 11. Auto-clear do feedback após 700 ms devolve o input para idle SEM ARIA.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { useState } from 'react';
import {
  PopoverQtyInput,
  normalizeQty,
  MIN_QTY,
  MAX_QTY,
} from '../PopoverQtyInput';

/** PRNG determinística (Mulberry32) — reprodutibilidade absoluta. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHARSET =
  '0123456789 abcdefghijABCDEFGHIJ.,-+/\\@#$%*()[]{}éÇ\u00A0\t\n"\'';

function randomString(rand: () => number, maxLen = 16): string {
  const n = Math.floor(rand() * maxLen);
  let s = '';
  for (let i = 0; i < n; i++) {
    s += CHARSET[Math.floor(rand() * CHARSET.length)];
  }
  return s;
}

/** Wrapper controlado — espelha o uso real (parent detém o `quantity`). */
function Controlled({
  itemId,
  initial = 10,
  onCommitSpy,
}: {
  itemId: string;
  initial?: number;
  onCommitSpy?: (n: number) => void;
}) {
  const [q, setQ] = useState(initial);
  return (
    <PopoverQtyInput
      itemId={itemId}
      productName={`P-${itemId}`}
      quantity={q}
      onCommit={(n) => {
        onCommitSpy?.(n);
        setQ(n);
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SEÇÃO 1 · PROPERTY-BASED sobre `normalizeQty` (1000 amostras)
// ─────────────────────────────────────────────────────────────────────────
describe('normalizeQty — property-based (1000 amostras)', () => {
  it('resultado sempre em [MIN_QTY, MAX_QTY] ou null', () => {
    const rand = mulberry32(0xc0ffee);
    for (let i = 0; i < 1000; i++) {
      const s = randomString(rand, 20);
      const r = normalizeQty(s);
      if (r !== null) {
        expect(Number.isInteger(r)).toBe(true);
        expect(r).toBeGreaterThanOrEqual(MIN_QTY);
        expect(r).toBeLessThanOrEqual(MAX_QTY);
      }
    }
  });

  it('idempotência: normalize(String(normalize(x))) === normalize(x)', () => {
    const rand = mulberry32(0xdeadbeef);
    for (let i = 0; i < 1000; i++) {
      const s = randomString(rand, 20);
      const once = normalizeQty(s);
      if (once === null) continue;
      const twice = normalizeQty(String(once));
      expect(twice).toBe(once);
    }
  });

  it('respeita a extração de dígitos por regex /[^0-9]/g', () => {
    const rand = mulberry32(0x1234abcd);
    for (let i = 0; i < 1000; i++) {
      const s = randomString(rand, 20);
      const digits = s.replace(/[^0-9]/g, '');
      const expected =
        digits.length === 0
          ? null
          : (() => {
              const p = parseInt(digits, 10);
              if (Number.isNaN(p) || p < MIN_QTY) return null;
              return Math.min(MAX_QTY, p);
            })();
      expect(normalizeQty(s)).toBe(expected);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// SEÇÃO 2 · BOUNDARY SWEEP — todos os pontos críticos ±3
// ─────────────────────────────────────────────────────────────────────────
describe('normalizeQty — boundary sweep', () => {
  const points = [
    -1,
    0,
    MIN_QTY - 1,
    MIN_QTY,
    MIN_QTY + 1,
    100,
    999,
    9999,
    99_999,
    MAX_QTY - 1,
    MAX_QTY,
    MAX_QTY + 1,
    MAX_QTY + 100,
    MAX_QTY * 10,
    Number.MAX_SAFE_INTEGER,
  ];

  for (const n of points) {
    it(`ponto ${n}`, () => {
      const r = normalizeQty(String(n));
      if (n < MIN_QTY) {
        // Valores negativos viram positivos (o `-` cai fora), então
        // -1 => digits '1' => 1. Isso é intencional: aceitamos como 1.
        if (String(n).replace(/[^0-9]/g, '') === '') {
          expect(r).toBeNull();
        } else {
          const d = parseInt(String(n).replace(/[^0-9]/g, ''), 10);
          const exp = d < MIN_QTY ? null : Math.min(MAX_QTY, d);
          expect(r).toBe(exp);
        }
      } else if (n > MAX_QTY) {
        expect(r).toBe(MAX_QTY);
      } else {
        expect(r).toBe(n);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// SEÇÃO 3 · FUZZ DE COMMIT — 200 sequências digitação + Enter
// ─────────────────────────────────────────────────────────────────────────
describe('<PopoverQtyInput /> — fuzz de commit (200 sequências)', () => {
  afterEach(() => cleanup());

  it('para toda entrada aleatória, o commit produz um estado consistente', () => {
    const rand = mulberry32(0xfa2be5);
    for (let i = 0; i < 200; i++) {
      const raw = randomString(rand, 12);
      const initial = 1 + Math.floor(rand() * 500);
      const spy = vi.fn();
      const id = `fuzz-${i}`;
      render(<Controlled itemId={id} initial={initial} onCommitSpy={spy} />);
      const input = screen.getByTestId(`cart-item-qty-${id}`) as HTMLInputElement;
      act(() => input.focus());
      fireEvent.change(input, { target: { value: raw } });
      // Sanitização acontece na mesma hora — o valor exposto é só dígitos.
      expect(/^[0-9]*$/.test(input.value)).toBe(true);

      const expected = normalizeQty(raw);
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.blur(input);

      if (expected === null) {
        // Reverte para initial e marca invalid.
        expect(input.value).toBe(String(initial));
        expect(input.dataset.feedback).toBe('invalid');
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(spy).not.toHaveBeenCalled();
      } else if (expected === initial) {
        // Sem mudança semântica → onCommit NÃO é chamado.
        expect(input.value).toBe(String(initial));
        expect(spy).not.toHaveBeenCalled();
      } else {
        expect(input.value).toBe(String(expected));
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(expected);
      }

      // O input NUNCA fica com caractere não-dígito no value final.
      expect(/^[0-9]*$/.test(input.value)).toBe(true);

      cleanup();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// SEÇÃO 4 · CLAMP EXAUSTIVO acima do MAX
// ─────────────────────────────────────────────────────────────────────────
describe('clamp acima do MAX_QTY', () => {
  afterEach(() => cleanup());

  const overMax = [
    1_000_000, 1_000_001, 9_999_999, 12_345_678, 999_999_999,
    // Bem grande — parseInt ainda funciona porque não excede safe integer:
    9_007_199_254_740_000,
  ];

  for (const v of overMax) {
    it(`entrada ${v} → clamp para ${MAX_QTY}`, () => {
      const spy = vi.fn();
      const id = `clamp-${v}`;
      render(<Controlled itemId={id} initial={10} onCommitSpy={spy} />);
      const input = screen.getByTestId(`cart-item-qty-${id}`) as HTMLInputElement;
      act(() => input.focus());
      fireEvent.change(input, { target: { value: String(v) } });
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.blur(input);
      expect(input.value).toBe(String(MAX_QTY));
      expect(input.dataset.feedback).toBe('clamped');
      expect(spy).toHaveBeenCalledWith(MAX_QTY);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// SEÇÃO 5 · ESC MANTÉM FOCO + REVERTE (50 simulações)
// ─────────────────────────────────────────────────────────────────────────
describe('Esc: mantém foco no input e reverte', () => {
  afterEach(() => cleanup());

  it('50 simulações — foco permanece no input após Esc', () => {
    const rand = mulberry32(0xe5c);
    for (let i = 0; i < 50; i++) {
      const initial = 1 + Math.floor(rand() * 900);
      const typed = String(1 + Math.floor(rand() * 10_000_000));
      const id = `esc-${i}`;
      const spy = vi.fn();
      render(<Controlled itemId={id} initial={initial} onCommitSpy={spy} />);
      const input = screen.getByTestId(`cart-item-qty-${id}`) as HTMLInputElement;
      act(() => input.focus());
      fireEvent.change(input, { target: { value: typed } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(input.value).toBe(String(initial));
      expect(input.dataset.feedback).toBe('idle');
      expect(input.hasAttribute('aria-invalid')).toBe(false);
      expect(input.hasAttribute('aria-describedby')).toBe(false);
      expect(document.activeElement).toBe(input);
      expect(spy).not.toHaveBeenCalled();
      cleanup();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// SEÇÃO 6 · ISOLAMENTO — 20 inputs em paralelo
// ─────────────────────────────────────────────────────────────────────────
describe('Isolamento de estado entre múltiplos inputs (N=20)', () => {
  function MultiHarness({ n }: { n: number }) {
    const [qs, setQs] = useState<number[]>(() =>
      Array.from({ length: n }, (_, i) => 10 + i),
    );
    return (
      <div>
        {qs.map((q, i) => (
          <PopoverQtyInput
            key={i}
            itemId={`multi-${i}`}
            productName={`P-${i}`}
            quantity={q}
            onCommit={(next) =>
              setQs((prev) => prev.map((old, j) => (j === i ? next : old)))
            }
          />
        ))}
      </div>
    );
  }

  afterEach(() => cleanup());

  it('feedback e valor de um item NÃO vazam para os outros 19', () => {
    const N = 20;
    render(<MultiHarness n={N} />);
    const inputs = Array.from({ length: N }, (_, i) =>
      screen.getByTestId(`cart-item-qty-multi-${i}`),
    ) as HTMLInputElement[];

    // Aplica estados distintos por item, alternando entre válido/inválido/clamp.
    const scenarios: Array<{ raw: string; expectFeedback: string; expectValue: string }> = [];
    for (let i = 0; i < N; i++) {
      const mod = i % 4;
      if (mod === 0) scenarios.push({ raw: String(100 + i), expectFeedback: 'idle', expectValue: String(100 + i) });
      else if (mod === 1) scenarios.push({ raw: '9999999', expectFeedback: 'clamped', expectValue: String(MAX_QTY) });
      else if (mod === 2) scenarios.push({ raw: '', expectFeedback: 'invalid', expectValue: String(10 + i) });
      // mod===3: entrada com lixo → sanitizada para o dígito `i` (ex.: 'x,y3' → '3').
      // O flash('sanitized') é disparado no change e persiste após o Enter (o
      // commit só troca para 'clamped' quando digitsOnly > MAX). Como i ∈ [3..19],
      // o dígito extraído é sempre ≥ MIN_QTY, então o commit é aceito.
      else {
        const digit = i; // "x,y" + i → digits '' + i → parseInt(i)
        scenarios.push({ raw: `x,y${i}`, expectFeedback: 'sanitized', expectValue: String(digit) });
      }
    }

    for (let i = 0; i < N; i++) {
      const input = inputs[i];
      act(() => input.focus());
      fireEvent.change(input, { target: { value: scenarios[i].raw } });
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.blur(input);
    }

    for (let i = 0; i < N; i++) {
      const input = inputs[i];
      expect(input.value, `input ${i} value`).toBe(scenarios[i].expectValue);
      expect(input.dataset.feedback, `input ${i} feedback`).toBe(
        scenarios[i].expectFeedback,
      );
      // ARIA describedby coerente com feedback.
      if (scenarios[i].expectFeedback === 'idle') {
        expect(input.hasAttribute('aria-describedby')).toBe(false);
      } else {
        expect(input.getAttribute('aria-describedby')).toBe(
          `cart-item-qty-fb-multi-${i}`,
        );
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// SEÇÃO 7 · ARIA / role=status / aria-live — invariantes por estado
// ─────────────────────────────────────────────────────────────────────────
describe('ARIA invariante por estado de feedback', () => {
  afterEach(() => cleanup());

  it.each([
    ['sanitized', '5,3', 'change', 'Apenas dígitos são aceitos'],
    ['clamped', '9999999', 'enter', `Valor limitado a ${MAX_QTY.toLocaleString('pt-BR')}`],
    ['invalid', '', 'enter', 'Valor inválido — quantidade restaurada'],
  ])('feedback=%s → role=status + aria-live=polite + mensagem correta', (
    expectedFb,
    raw,
    trigger,
    msg,
  ) => {
    const id = `aria-${expectedFb}`;
    render(<Controlled itemId={id} initial={10} />);
    const input = screen.getByTestId(`cart-item-qty-${id}`) as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: raw as string } });
    if (trigger === 'enter') {
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.blur(input);
    }
    expect(input.dataset.feedback).toBe(expectedFb);
    const fb = document.getElementById(`cart-item-qty-fb-${id}`)!;
    expect(fb).not.toBeNull();
    expect(fb.getAttribute('role')).toBe('status');
    expect(fb.getAttribute('aria-live')).toBe('polite');
    expect(fb.textContent).toBe(msg);
    if (expectedFb === 'invalid') {
      expect(input.getAttribute('aria-invalid')).toBe('true');
    } else {
      expect(input.hasAttribute('aria-invalid')).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// SEÇÃO 8 · AUTO-CLEAR (fake timers) — feedback expira em 700 ms
// ─────────────────────────────────────────────────────────────────────────
describe('Auto-clear do feedback após 700 ms', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('sanitized → idle após 700ms e ARIA some', () => {
    const id = 'timer-san';
    render(<Controlled itemId={id} initial={10} />);
    const input = screen.getByTestId(`cart-item-qty-${id}`) as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '5,3' } });
    expect(input.dataset.feedback).toBe('sanitized');
    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(input.dataset.feedback).toBe('idle');
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(document.getElementById(`cart-item-qty-fb-${id}`)).toBeNull();
  });

  it('clamped → idle após 700ms', () => {
    const id = 'timer-cla';
    render(<Controlled itemId={id} initial={10} />);
    const input = screen.getByTestId(`cart-item-qty-${id}`) as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '9999999' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(input.dataset.feedback).toBe('clamped');
    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(input.dataset.feedback).toBe('idle');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// SEÇÃO 9 · SEQUÊNCIAS ALEATÓRIAS Enter/Esc/change (200 runs)
// ─────────────────────────────────────────────────────────────────────────
describe('Sequências aleatórias de teclado (200 runs)', () => {
  afterEach(() => cleanup());

  it('estado final é sempre um dígito válido ∈ [MIN, MAX] ou o initial', () => {
    const rand = mulberry32(0xa11ce);
    for (let i = 0; i < 200; i++) {
      const initial = 1 + Math.floor(rand() * 500);
      const id = `seq-${i}`;
      render(<Controlled itemId={id} initial={initial} />);
      const input = screen.getByTestId(`cart-item-qty-${id}`) as HTMLInputElement;
      act(() => input.focus());

      const steps = 3 + Math.floor(rand() * 6);
      for (let s = 0; s < steps; s++) {
        const op = Math.floor(rand() * 4);
        if (op === 0) {
          fireEvent.change(input, { target: { value: randomString(rand, 8) } });
        } else if (op === 1) {
          fireEvent.keyDown(input, { key: 'Enter' });
          fireEvent.blur(input);
          act(() => input.focus());
        } else if (op === 2) {
          fireEvent.keyDown(input, { key: 'Escape' });
        } else {
          fireEvent.change(input, {
            target: { value: String(Math.floor(rand() * 2_000_000)) },
          });
        }
      }
      // Fecha a interação com blur/commit.
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.blur(input);

      // Invariantes finais.
      expect(/^[0-9]+$/.test(input.value)).toBe(true);
      const n = parseInt(input.value, 10);
      expect(n).toBeGreaterThanOrEqual(MIN_QTY);
      expect(n).toBeLessThanOrEqual(MAX_QTY);
      cleanup();
    }
  });
});
