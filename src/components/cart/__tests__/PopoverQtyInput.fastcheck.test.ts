/**
 * Property-based com fast-check para `normalizeQty`.
 *
 * O diferencial em relação à bateria exaustiva anterior (que usa uma PRNG
 * Mulberry32 sem shrinking) é o SHRINKING AUTOMÁTICO: quando uma propriedade
 * quebra, fast-check reduz o contra-exemplo ao MENOR input possível que
 * ainda reproduz a falha. Isso torna qualquer regressão futura óbvia.
 *
 * Configuração: 500 runs por propriedade × 8 propriedades = 4000 execuções
 * determinísticas (mesmo seed sempre; fast-check imprime o seed em falhas).
 */
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { normalizeQty, MIN_QTY, MAX_QTY } from '../PopoverQtyInput';

const NUM_RUNS = 500;

/** Espelho de referência: extração direta por regex, para cross-check. */
function referenceNormalize(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 0) return null;
  const p = parseInt(digits, 10);
  if (Number.isNaN(p) || p < MIN_QTY) return null;
  return Math.min(MAX_QTY, p);
}

describe('normalizeQty · property-based (fast-check, shrinking automático)', () => {
  it('P1 · resultado ∈ [MIN_QTY, MAX_QTY] ou null (∀ string Unicode)', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const r = normalizeQty(raw);
        if (r === null) return true;
        return (
          Number.isInteger(r) && r >= MIN_QTY && r <= MAX_QTY
        );
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('P2 · IDEMPOTÊNCIA: normalize(String(normalize(x))) === normalize(x)', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const once = normalizeQty(raw);
        if (once === null) return true;
        return normalizeQty(String(once)) === once;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('P3 · CONCORDÂNCIA com implementação de referência (regex + parseInt)', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (raw) => {
        return normalizeQty(raw) === referenceNormalize(raw);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('P4 · MONOTONICIDADE: inteiros positivos preservam ordem até o clamp', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_QTY }),
        fc.integer({ min: 1, max: MAX_QTY }),
        (a, b) => {
          const na = normalizeQty(String(a))!;
          const nb = normalizeQty(String(b))!;
          if (a <= b) return na <= nb;
          return na >= nb;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('P5 · CLAMP: qualquer inteiro ≥ MAX_QTY normaliza para exatamente MAX_QTY', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_QTY, max: Number.MAX_SAFE_INTEGER }),
        (n) => normalizeQty(String(n)) === MAX_QTY,
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('P6 · IDENTIDADE no intervalo válido: n ∈ [MIN, MAX] ⇒ normalize(String(n)) === n', () => {
    fc.assert(
      fc.property(fc.integer({ min: MIN_QTY, max: MAX_QTY }), (n) => {
        return normalizeQty(String(n)) === n;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('P7 · SANITIZAÇÃO cross-check: lixo intercalado não altera o dígito extraído', () => {
    const junk = fc.stringMatching(/^[^0-9]{0,4}$/);
    fc.assert(
      fc.property(
        junk,
        fc.integer({ min: 1, max: MAX_QTY }),
        junk,
        (pre, n, post) => {
          return normalizeQty(pre + String(n) + post) === n;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('P8 · STRING SEM DÍGITO nunca é aceita (retorna null)', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[^0-9]*$/), (raw) => {
        return normalizeQty(raw) === null;
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
