/**
 * Testes exaustivos do guard de transição de status do carrinho (SSOT).
 *
 * Cobertura:
 *  1. Matriz canônica: cada CartStatus × contagem 0/1/N.
 *  2. Determinismo: mesma entrada → mesma decisão em 1000 execuções.
 *  3. Fuzz de itemCount: 500 valores aleatórios (int/float/negativo/NaN/
 *     Infinity/null/undefined/coerções esdrúxulas via `as any`).
 *  4. Property-based (500 casos): se itemCount normalizado >= 1 então
 *     pronto_orcamento é sempre allowed; caso contrário, sempre blocked.
 *  5. Regressão específica: NaN, +/-Infinity, -0, 0.9, "3" (string) e
 *     objetos falsy nunca burlam o guard.
 *  6. Estabilidade da mensagem: `EMPTY_CART_BLOCK_MESSAGE` idêntica em
 *     todas as decisões blocked (SSOT de copy).
 *  7. Guard nunca lança — mesmo com inputs adversariais.
 *  8. `em_separacao` nunca é bloqueado, para nenhum itemCount.
 */
import { describe, it, expect } from 'vitest';
import {
  EMPTY_CART_BLOCK_MESSAGE,
  EMPTY_CART_BLOCK_TITLE,
  evaluateCartStatusTransition,
  normalizeItemCount,
} from '@/lib/carts/status-transition-guard';
import type { CartStatus } from '@/hooks/products';

const ALL_STATUSES: CartStatus[] = ['em_separacao', 'pronto_orcamento'];

describe('normalizeItemCount — sanitização defensiva', () => {
  it.each([
    [0, 0],
    [1, 1],
    [10, 10],
    [999_999, 999_999],
    [1.4, 1],
    [1.9, 1],
    [0.9, 0],
    [-1, 0],
    [-1000, 0],
    [-0, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [Number.NEGATIVE_INFINITY, 0],
    [null as unknown as number, 0],
    [undefined as unknown as number, 0],
    ['3' as unknown as number, 0],
    ['0' as unknown as number, 0],
    [true as unknown as number, 0],
    [false as unknown as number, 0],
    [{} as unknown as number, 0],
    [[] as unknown as number, 0],
  ])('normalizeItemCount(%p) === %p', (input, expected) => {
    expect(normalizeItemCount(input)).toBe(expected);
  });
});

describe('evaluateCartStatusTransition — matriz canônica', () => {
  it('em_separacao é sempre permitido', () => {
    for (const count of [0, 1, 5, 100, -3, Number.NaN]) {
      const d = evaluateCartStatusTransition({
        nextStatus: 'em_separacao',
        itemCount: count as number,
      });
      expect(d.allowed).toBe(true);
    }
  });

  it('pronto_orcamento com 0 itens é bloqueado', () => {
    const d = evaluateCartStatusTransition({
      nextStatus: 'pronto_orcamento',
      itemCount: 0,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.reason).toBe('empty_cart_ready_blocked');
      expect(d.message).toBe(EMPTY_CART_BLOCK_MESSAGE);
    }
  });

  it('pronto_orcamento com 1+ itens é permitido', () => {
    for (const n of [1, 2, 5, 50, 1000]) {
      const d = evaluateCartStatusTransition({
        nextStatus: 'pronto_orcamento',
        itemCount: n,
      });
      expect(d.allowed, `count=${n}`).toBe(true);
    }
  });

  it('SSOT dos textos: TITLE e MESSAGE são strings estáveis não-vazias', () => {
    expect(EMPTY_CART_BLOCK_TITLE).toBe('Carrinho vazio');
    expect(EMPTY_CART_BLOCK_MESSAGE).toMatch(/pronto para orçamento/i);
    expect(EMPTY_CART_BLOCK_MESSAGE.length).toBeGreaterThan(20);
  });
});

describe('evaluateCartStatusTransition — determinismo (1000×)', () => {
  it('mesmo input → mesmo output em 1000 execuções', () => {
    const inputs: Array<{ nextStatus: CartStatus; itemCount: number }> = [];
    for (let i = 0; i < 1000; i++) {
      inputs.push({
        nextStatus: ALL_STATUSES[i % ALL_STATUSES.length],
        itemCount: i % 7,
      });
    }
    const first = inputs.map((inp) => JSON.stringify(evaluateCartStatusTransition(inp)));
    const second = inputs.map((inp) => JSON.stringify(evaluateCartStatusTransition(inp)));
    expect(first).toEqual(second);
  });
});

/** RNG determinístico (Mulberry32) — reproduzível entre execuções de CI. */
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

describe('evaluateCartStatusTransition — fuzz de itemCount (500 casos)', () => {
  const rand = mulberry32(0xC0FFEE);

  const adversarial: Array<unknown> = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -0,
    -1,
    -9999,
    0.5,
    0.9,
    1.0000001,
    '0',
    '1',
    '10',
    '',
    null,
    undefined,
    true,
    false,
    {},
    [],
    () => 1,
  ];

  it('nenhuma entrada adversarial autoriza pronto_orcamento incorretamente', () => {
    for (const bad of adversarial) {
      const d = evaluateCartStatusTransition({
        nextStatus: 'pronto_orcamento',
        itemCount: bad as number,
      });
      // Só é permitido quando `bad` for número finito >= 1.
      const normalized = normalizeItemCount(bad as number);
      const shouldAllow = normalized >= 1;
      expect(d.allowed, `input=${String(bad)} normalized=${normalized}`).toBe(shouldAllow);
    }
  });

  it('500 fuzz cases: allowed ⇔ normalizeItemCount(...) >= 1 quando nextStatus=pronto_orcamento', () => {
    let allowed = 0;
    let blocked = 0;
    for (let i = 0; i < 500; i++) {
      // Mistura entre inteiros, floats, negativos e "sujeira".
      const roll = rand();
      let count: unknown;
      if (roll < 0.25) count = Math.floor(rand() * 20) - 5; // int -5..14
      else if (roll < 0.5) count = rand() * 10 - 2; // float -2..8
      else if (roll < 0.65) count = adversarial[Math.floor(rand() * adversarial.length)];
      else count = Math.floor(rand() * 1000); // int 0..999

      const d = evaluateCartStatusTransition({
        nextStatus: 'pronto_orcamento',
        itemCount: count as number,
      });
      const shouldAllow = normalizeItemCount(count as number) >= 1;
      expect(d.allowed, `i=${i} count=${String(count)}`).toBe(shouldAllow);
      if (d.allowed) allowed++;
      else blocked++;
    }
    // Sanidade: fuzz deve cobrir ambos os ramos.
    expect(allowed).toBeGreaterThan(0);
    expect(blocked).toBeGreaterThan(0);
  });

  it('guard NUNCA lança — 500 chamadas com inputs arbitrários', () => {
    for (let i = 0; i < 500; i++) {
      const junk = adversarial[i % adversarial.length];
      expect(() =>
        evaluateCartStatusTransition({
          nextStatus: (i % 3 === 0 ? 'pronto_orcamento' : 'em_separacao') as CartStatus,
          itemCount: junk as number,
        }),
      ).not.toThrow();
    }
  });
});

describe('evaluateCartStatusTransition — property-based (500 pares)', () => {
  const rand = mulberry32(0xBADC0DE);

  it('para pronto_orcamento: allowed ⇔ itemCount normalizado >= 1', () => {
    for (let i = 0; i < 500; i++) {
      const count = Math.floor(rand() * 50) - 10; // -10..39
      const d = evaluateCartStatusTransition({
        nextStatus: 'pronto_orcamento',
        itemCount: count,
      });
      const norm = normalizeItemCount(count);
      if (norm >= 1) expect(d.allowed).toBe(true);
      else {
        expect(d.allowed).toBe(false);
        if (!d.allowed) expect(d.reason).toBe('empty_cart_ready_blocked');
      }
    }
  });

  it('em_separacao é sempre allowed independentemente de itemCount', () => {
    for (let i = 0; i < 200; i++) {
      const count = Math.floor(rand() * 200) - 100;
      const d = evaluateCartStatusTransition({
        nextStatus: 'em_separacao',
        itemCount: count,
      });
      expect(d.allowed).toBe(true);
    }
  });
});
