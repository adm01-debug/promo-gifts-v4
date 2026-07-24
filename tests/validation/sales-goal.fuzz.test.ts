import { describe, expect, it } from 'vitest';
import { salesGoalSchema } from '@/lib/validations/goalSchema';

type FuzzCase = {
  seed: number;
  payload: unknown;
  field: 'text' | 'numeric' | 'date' | 'enum';
  why: string;
};

function mulberry32(seed: number) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)]!;
}

const BASE_VALID = {
  title: 'Meta mensal válida',
  target_value: 1000,
  goal_type: 'revenue',
  period: 'monthly',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  notes: 'ok',
};

function makeCase(seed: number): FuzzCase {
  const rng = mulberry32(seed);
  const field = pick(rng, ['text', 'numeric', 'date', 'enum'] as const);
  const payload: Record<string, unknown> = { ...BASE_VALID };

  if (field === 'text') {
    const bad = pick(rng, ['', 'x', 'A'.repeat(5000), '<script>alert(1)</script>', String.fromCharCode(0)]);
    payload.title = bad;
    payload.notes = 'N'.repeat(501);
    return { seed, payload, field, why: 'texto inválido (mínimo/máximo/caracteres de controle)' };
  }

  if (field === 'numeric') {
    const bad = pick(rng, [-1, 0, Number.NaN, Number.POSITIVE_INFINITY, 1e12]);
    payload.target_value = bad;
    return { seed, payload, field, why: 'numérico inválido (negativo/zero/NaN/Infinity/overflow)' };
  }

  if (field === 'date') {
    const start = pick(rng, ['not-a-date', '2026-13-99', '2026-02-30', '2026-00-10']);
    const end = pick(rng, ['not-a-date', '2026-00-00', '2026-02-31', '2026-15-40']);
    payload.start_date = start;
    payload.end_date = end;
    return { seed, payload, field, why: 'datas malformadas ou ambíguas' };
  }

  payload.goal_type = pick(rng, ['REVENUE', 'money', '', null, undefined]);
  payload.period = pick(rng, ['month', 'MONTHLY', '', null, undefined]);
  return { seed, payload, field, why: 'enum inválido (fora do domínio/case incorreto)' };
}

describe('salesGoalSchema fuzz de validação', () => {
  it('rejeita payloads randômicos e malformados com seed reproduzível', () => {
    const seeds = Array.from({ length: 80 }, (_, i) => 20260525 + i);
    const weakValidations: FuzzCase[] = [];

    for (const seed of seeds) {
      const fuzzCase = makeCase(seed);
      const result = salesGoalSchema.safeParse(fuzzCase.payload);
      if (result.success) weakValidations.push(fuzzCase);
    }

    if (weakValidations.length > 0) {
      const reproduction = weakValidations
        .map((f) => `seed=${f.seed} campo=${f.field} motivo=${f.why} payload=${JSON.stringify(f.payload)}`)
        .join('\n');
      throw new Error(`Foram encontradas validações fracas (${weakValidations.length}). Reproduções:\n${reproduction}`);
    }

    expect(weakValidations).toHaveLength(0);
  });
});
