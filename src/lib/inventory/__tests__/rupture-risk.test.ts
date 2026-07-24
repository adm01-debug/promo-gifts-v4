/**
 * Unit tests for the predictive rupture-risk SSOT (rupture-risk.ts).
 *
 * Run: TZ=America/Sao_Paulo npx vitest run src/lib/inventory/__tests__/rupture-risk.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  computeRuptureRisk,
  RUPTURE_HORIZON_OPTIONS,
  DEFAULT_RUPTURE_HORIZON,
  type RuptureRiskInput,
} from '@/lib/inventory/rupture-risk';

const input = (over: Partial<RuptureRiskInput> = {}): RuptureRiskInput => ({
  current: 100,
  avgDailyDepletion: 5,
  targetQty: 20,
  horizonDays: 3,
  ...over,
});

describe('rupture-risk constants', () => {
  it('exposes the canonical horizon options', () => {
    expect(RUPTURE_HORIZON_OPTIONS).toEqual([3, 7, 15, 30]);
  });

  it('defaults the horizon to 3 days', () => {
    expect(DEFAULT_RUPTURE_HORIZON).toBe(3);
  });
});

describe('computeRuptureRisk — precondition guards on current', () => {
  it('returns no-risk/null when current is NaN', () => {
    expect(computeRuptureRisk(input({ current: NaN }))).toEqual({
      atRisk: false,
      projectedStock: null,
      daysToTarget: null,
    });
  });

  it('returns no-risk/null when current is Infinity', () => {
    expect(computeRuptureRisk(input({ current: Infinity }))).toEqual({
      atRisk: false,
      projectedStock: null,
      daysToTarget: null,
    });
  });

  it('returns no-risk/null when current is negative', () => {
    expect(computeRuptureRisk(input({ current: -1 }))).toEqual({
      atRisk: false,
      projectedStock: null,
      daysToTarget: null,
    });
  });
});

describe('computeRuptureRisk — zero-stock fallback (max risk)', () => {
  it('flags current === 0 as max risk regardless of other inputs', () => {
    expect(
      computeRuptureRisk({
        current: 0,
        avgDailyDepletion: null,
        targetQty: null,
        horizonDays: 0,
      }),
    ).toEqual({ atRisk: true, projectedStock: 0, daysToTarget: 0 });
  });

  it('flags current === 0 even when other inputs are valid', () => {
    expect(computeRuptureRisk(input({ current: 0 }))).toEqual({
      atRisk: true,
      projectedStock: 0,
      daysToTarget: 0,
    });
  });
});

describe('computeRuptureRisk — missing/invalid avgDailyDepletion', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['zero', 0],
    ['negative', -2],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ])('returns no-risk/null when avgDailyDepletion is %s', (_label, value) => {
    expect(computeRuptureRisk(input({ avgDailyDepletion: value! }))).toEqual({
      atRisk: false,
      projectedStock: null,
      daysToTarget: null,
    });
  });
});

describe('computeRuptureRisk — missing/invalid targetQty', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['zero', 0],
    ['negative', -5],
    ['NaN', NaN],
  ])('returns no-risk/null when targetQty is %s', (_label, value) => {
    expect(computeRuptureRisk(input({ targetQty: value! }))).toEqual({
      atRisk: false,
      projectedStock: null,
      daysToTarget: null,
    });
  });
});

describe('computeRuptureRisk — missing/invalid horizonDays', () => {
  it.each([
    ['zero', 0],
    ['negative', -3],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ])('returns no-risk/null when horizonDays is %s', (_label, value) => {
    expect(computeRuptureRisk(input({ horizonDays: value }))).toEqual({
      atRisk: false,
      projectedStock: null,
      daysToTarget: null,
    });
  });
});

describe('computeRuptureRisk — projection math', () => {
  it('flags at risk when projected stock falls below the target within the window', () => {
    // 100 - 5*30 = -50 -> clamped to 0 < 20 -> atRisk
    const res = computeRuptureRisk(
      input({ current: 100, avgDailyDepletion: 5, targetQty: 20, horizonDays: 30 }),
    );
    expect(res.atRisk).toBe(true);
    expect(res.projectedStock).toBe(0);
    // daysToTarget = floor((100 - 20) / 5) = 16
    expect(res.daysToTarget).toBe(16);
  });

  it('does NOT flag at risk when projected stock stays at/above the target', () => {
    // 100 - 5*3 = 85 >= 20 -> not at risk
    const res = computeRuptureRisk(
      input({ current: 100, avgDailyDepletion: 5, targetQty: 20, horizonDays: 3 }),
    );
    expect(res.atRisk).toBe(false);
    expect(res.projectedStock).toBe(85);
    expect(res.daysToTarget).toBe(16);
  });

  it('clamps projected stock at 0 (never negative) and rounds', () => {
    // 10 - 3.4*5 = 10 - 17 = -7 -> clamp 0
    const res = computeRuptureRisk(
      input({ current: 10, avgDailyDepletion: 3.4, targetQty: 5, horizonDays: 5 }),
    );
    expect(res.projectedStock).toBe(0);
    expect(res.atRisk).toBe(true);
  });

  it('rounds the projected stock to the nearest integer', () => {
    // 50 - 2.3*3 = 50 - 6.9 = 43.1 -> round 43
    const res = computeRuptureRisk(
      input({ current: 50, avgDailyDepletion: 2.3, targetQty: 10, horizonDays: 3 }),
    );
    expect(res.projectedStock).toBe(43);
    expect(res.atRisk).toBe(false);
  });

  it('returns daysToTarget = 0 when current is already at or below target', () => {
    // current (15) <= targetQty (20) -> daysToTarget 0
    const res = computeRuptureRisk(
      input({ current: 15, avgDailyDepletion: 5, targetQty: 20, horizonDays: 3 }),
    );
    expect(res.daysToTarget).toBe(0);
    // projected = 15 - 15 = 0 < 20 -> at risk
    expect(res.projectedStock).toBe(0);
    expect(res.atRisk).toBe(true);
  });

  it('boundary: projected exactly equal to target is NOT at risk (strict <)', () => {
    // 30 - 5*2 = 20 == target 20 -> not < target -> not at risk
    const res = computeRuptureRisk(
      input({ current: 30, avgDailyDepletion: 5, targetQty: 20, horizonDays: 2 }),
    );
    expect(res.projectedStock).toBe(20);
    expect(res.atRisk).toBe(false);
  });
});
