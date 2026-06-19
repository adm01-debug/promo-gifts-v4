/**
 * Simulações exaustivas (centenas de cenários) para `computeRuptureRisk`.
 *
 * Estratégia: property-based testing manual com PRNG determinística (seed fixa)
 * para garantir reprodutibilidade. Cada bloco valida uma INVARIANTE da fórmula,
 * não um caso isolado, expondo gaps que testes pontuais não pegariam.
 *
 * Invariantes validadas:
 *  I1. Determinismo: mesma entrada → mesma saída.
 *  I2. Cap inferior: projectedStock ∈ [0, current] sempre.
 *  I3. Monotonia em horizonDays: ↑horizon ⇒ ↓projectedStock (não-estrito).
 *  I4. Monotonia em avgDailyDepletion: ↑avg ⇒ ↓projectedStock.
 *  I5. Monotonia em current: ↑current ⇒ ↑projectedStock.
 *  I6. atRisk ↔ projectedStock < targetQty (quando aplicável).
 *  I7. Pré-condições inválidas SEMPRE retornam atRisk=false, projected=null.
 *  I8. daysToTarget=0 quando current ≤ targetQty.
 *  I9. Consistência com exemplo canônico do PO em escala (×10, ×100, ×0.1).
 *  I10. Sem NaN/Infinity vazando no resultado.
 */
import { describe, it, expect } from 'vitest';
import { computeRuptureRisk, RUPTURE_HORIZON_OPTIONS } from '@/lib/inventory/rupture-risk';

// PRNG determinística (Mulberry32) — reprodutível entre runs/CI.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]) => arr[randInt(0, arr.length - 1)];

interface Scenario {
  current: number;
  avgDailyDepletion: number;
  targetQty: number;
  horizonDays: number;
}

function genValidScenario(): Scenario {
  return {
    current: randInt(1, 100_000),
    avgDailyDepletion: randInt(1, 5_000),
    targetQty: randInt(1, 100_000),
    horizonDays: pick(RUPTURE_HORIZON_OPTIONS),
  };
}

const SCENARIOS: Scenario[] = Array.from({ length: 500 }, () => genValidScenario());

describe('Simulações exaustivas — 500 cenários determinísticos', () => {
  it('I1 — determinismo: mesma entrada produz mesma saída', () => {
    for (const s of SCENARIOS) {
      const a = computeRuptureRisk(s);
      const b = computeRuptureRisk(s);
      expect(a).toEqual(b);
    }
  });

  it('I2 — projectedStock sempre em [0, current]', () => {
    for (const s of SCENARIOS) {
      const r = computeRuptureRisk(s);
      expect(r.projectedStock).not.toBeNull();
      expect(r.projectedStock!).toBeGreaterThanOrEqual(0);
      expect(r.projectedStock!).toBeLessThanOrEqual(s.current);
    }
  });

  it('I3 — monotonia decrescente em horizonDays', () => {
    for (const s of SCENARIOS) {
      const projections = RUPTURE_HORIZON_OPTIONS.map(
        (h) => computeRuptureRisk({ ...s, horizonDays: h }).projectedStock!,
      );
      for (let i = 1; i < projections.length; i++) {
        expect(projections[i]).toBeLessThanOrEqual(projections[i - 1]);
      }
    }
  });

  it('I4 — monotonia decrescente em avgDailyDepletion', () => {
    for (const s of SCENARIOS) {
      const low = computeRuptureRisk({ ...s, avgDailyDepletion: 1 }).projectedStock!;
      const high = computeRuptureRisk({
        ...s,
        avgDailyDepletion: s.avgDailyDepletion + 1000,
      }).projectedStock!;
      expect(high).toBeLessThanOrEqual(low);
    }
  });

  it('I5 — monotonia crescente em current', () => {
    for (const s of SCENARIOS) {
      const a = computeRuptureRisk(s).projectedStock!;
      const b = computeRuptureRisk({ ...s, current: s.current + 500 }).projectedStock!;
      expect(b).toBeGreaterThanOrEqual(a);
    }
  });

  it('I6 — atRisk ↔ projectedStock < targetQty', () => {
    for (const s of SCENARIOS) {
      const r = computeRuptureRisk(s);
      expect(r.atRisk).toBe(r.projectedStock! < s.targetQty);
    }
  });

  it('I8 — daysToTarget=0 quando current ≤ targetQty', () => {
    for (const s of SCENARIOS) {
      const stressed = { ...s, current: s.targetQty }; // current == target
      const r = computeRuptureRisk(stressed);
      expect(r.daysToTarget).toBe(0);
    }
  });

  it('I10 — nenhum NaN/Infinity no resultado', () => {
    for (const s of SCENARIOS) {
      const r = computeRuptureRisk(s);
      expect(Number.isFinite(r.projectedStock!)).toBe(true);
      expect(r.daysToTarget === null || Number.isFinite(r.daysToTarget)).toBe(true);
    }
  });
});

describe('Simulações de pré-condições inválidas — 200 cenários', () => {
  // Conjuntos de invalidez por campo:
  //  - `current` aceita 0 (SKU esgotada = risco MÁXIMO documentado), portanto 0
  //    NÃO é inválido para current — só negativos/não-finitos/null/undefined são.
  //  - `avgDailyDepletion`/`targetQty`/`horizonDays` exigem > 0 finito, então 0
  //    também é inválido.
  const INVALID_POSITIVE_ONLY = [0, -1, -1000, NaN, Infinity, -Infinity, null, undefined] as const;
  const INVALID_CURRENT = [-1, -1000, NaN, Infinity, -Infinity, null, undefined] as const;

  it('I7 — campo inválido força atRisk=false e projected=null', () => {
    for (let i = 0; i < 200; i++) {
      const base = genValidScenario();
      const field = pick(['current', 'avgDailyDepletion', 'targetQty', 'horizonDays'] as const);
      const bad = pick(field === 'current' ? INVALID_CURRENT : INVALID_POSITIVE_ONLY);
      const r = computeRuptureRisk({ ...base, [field]: bad } as never);
      expect(r.atRisk).toBe(false);
      expect(r.projectedStock).toBeNull();
    }
  });

  it('I7b — current=0 é risco MÁXIMO (SKU esgotada), não pré-condição inválida', () => {
    // Independe de avg/target/horizonte: out-of-stock sempre entra no KPI de risco.
    for (let i = 0; i < 50; i++) {
      const base = genValidScenario();
      const r = computeRuptureRisk({ ...base, current: 0 });
      expect(r.atRisk).toBe(true);
      expect(r.projectedStock).toBe(0);
      expect(r.daysToTarget).toBe(0);
    }
  });
});

describe('Escala — exemplo canônico do PO em múltiplas magnitudes', () => {
  // Caso base: current=800, avg=120, target=500, h=3 → projected=440, atRisk=true
  it.each([
    { scale: 0.1, expectedProjected: 44 },
    { scale: 1, expectedProjected: 440 },
    { scale: 10, expectedProjected: 4400 },
    { scale: 100, expectedProjected: 44000 },
    { scale: 1000, expectedProjected: 440000 },
  ])('escala ×$scale preserva ratio (projected=$expectedProjected)', ({ scale, expectedProjected }) => {
    const r = computeRuptureRisk({
      current: 800 * scale,
      avgDailyDepletion: 120 * scale,
      targetQty: 500 * scale,
      horizonDays: 3,
    });
    expect(r.projectedStock).toBe(expectedProjected);
    expect(r.atRisk).toBe(true);
  });
});

describe('Fronteira — projeção exatamente no alvo NÃO é risco', () => {
  it('projectedStock === targetQty ⇒ atRisk=false (estrito <)', () => {
    // current - avg*h = target  →  800 - 100*3 = 500 = target
    const r = computeRuptureRisk({
      current: 800,
      avgDailyDepletion: 100,
      targetQty: 500,
      horizonDays: 3,
    });
    expect(r.projectedStock).toBe(500);
    expect(r.atRisk).toBe(false);
  });

  it('projectedStock = target − 1 ⇒ atRisk=true', () => {
    const r = computeRuptureRisk({
      current: 799,
      avgDailyDepletion: 100,
      targetQty: 500,
      horizonDays: 3,
    });
    expect(r.projectedStock).toBe(499);
    expect(r.atRisk).toBe(true);
  });
});
