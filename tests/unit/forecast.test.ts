/**
 * Unit tests for src/lib/forecast.ts
 *
 * linearRegression, detectAnomalies, projectForecast
 */
import { describe, it, expect } from 'vitest';
import { linearRegression, detectAnomalies, projectForecast } from '@/lib/forecast';

// ============================================
// linearRegression
// ============================================

describe('linearRegression', () => {
  it('returns zero slope/intercept/std for empty array', () => {
    const r = linearRegression([]);
    expect(r.slope).toBe(0);
    expect(r.intercept).toBe(0);
    expect(r.residualStd).toBe(0);
  });

  it('returns zero slope for single element (uses element as intercept)', () => {
    const r = linearRegression([42]);
    expect(r.slope).toBe(0);
    expect(r.intercept).toBe(42);
    expect(r.residualStd).toBe(0);
  });

  it('computes slope=0 for a flat series', () => {
    const r = linearRegression([5, 5, 5, 5]);
    expect(r.slope).toBe(0);
    expect(r.intercept).toBe(5);
    expect(r.residualStd).toBe(0);
  });

  it('computes slope=1 and intercept=0 for [0,1,2,3]', () => {
    const r = linearRegression([0, 1, 2, 3]);
    expect(r.slope).toBeCloseTo(1, 10);
    expect(r.intercept).toBeCloseTo(0, 10);
    expect(r.residualStd).toBeCloseTo(0, 10);
  });

  it('computes slope=-1 and intercept=3 for [3,2,1,0]', () => {
    const r = linearRegression([3, 2, 1, 0]);
    expect(r.slope).toBeCloseTo(-1, 10);
    expect(r.intercept).toBeCloseTo(3, 10);
    expect(r.residualStd).toBeCloseTo(0, 10);
  });

  it('computes positive slope for an increasing series with noise', () => {
    const r = linearRegression([1, 3, 2, 5, 4, 7, 6]);
    expect(r.slope).toBeGreaterThan(0);
  });

  it('residualStd is 0 for a perfectly linear series', () => {
    const r = linearRegression([2, 4, 6, 8, 10]);
    expect(r.residualStd).toBeCloseTo(0, 8);
  });

  it('residualStd is positive when there is scatter', () => {
    const r = linearRegression([1, 10, 2, 11, 3]);
    expect(r.residualStd).toBeGreaterThan(0);
  });

  it('handles two-element series', () => {
    const r = linearRegression([0, 2]);
    expect(r.slope).toBeCloseTo(2, 8);
    expect(r.intercept).toBeCloseTo(0, 8);
  });
});

// ============================================
// detectAnomalies
// ============================================

describe('detectAnomalies', () => {
  it('returns all false for fewer than 4 values', () => {
    expect(detectAnomalies([1, 2, 3])).toEqual([false, false, false]);
    expect(detectAnomalies([])).toEqual([]);
    expect(detectAnomalies([5])).toEqual([false]);
  });

  it('returns all false when std is 0 (all values equal)', () => {
    expect(detectAnomalies([7, 7, 7, 7, 7])).toEqual([false, false, false, false, false]);
  });

  it('detects a clear outlier at default threshold (2σ) with sufficient data', () => {
    // 6 "normal" values + 1 extreme outlier: z ≈ 2.45 > 2
    const result = detectAnomalies([1, 1, 1, 1, 1, 1, 100]);
    expect(result[6]).toBe(true);
    expect(result.slice(0, 6).every((v) => v === false)).toBe(true);
  });

  it('does not flag values within threshold', () => {
    const result = detectAnomalies([10, 11, 10, 11, 10]);
    expect(result.every((v) => v === false)).toBe(true);
  });

  it('respects custom threshold (threshold=1, moderately far value)', () => {
    // 6 normal values + 1 moderate outlier: z ≈ 2.45 > 1
    const result = detectAnomalies([1, 1, 1, 1, 1, 1, 20], 1);
    expect(result[6]).toBe(true);
  });

  it('no anomalies in perfectly uniform 4+ series', () => {
    const result = detectAnomalies([5, 5, 5, 5, 5, 5]);
    expect(result.every((v) => v === false)).toBe(true);
  });
});

// ============================================
// projectForecast
// ============================================

describe('projectForecast', () => {
  it('returns series as-is when fewer than 3 points', () => {
    const series = [
      { date: '2024-01-01', value: 10 },
      { date: '2024-01-02', value: 20 },
    ];
    const result = projectForecast(series, 3);
    expect(result).toHaveLength(2);
    expect(result.every((p) => !p.isForecast)).toBe(true);
  });

  it('appends forecastDays projected points', () => {
    const series = [
      { date: '2024-01-01', value: 10 },
      { date: '2024-01-02', value: 20 },
      { date: '2024-01-03', value: 30 },
    ];
    const result = projectForecast(series, 3);
    expect(result).toHaveLength(6); // 3 historical + 3 forecast
    expect(result.slice(0, 3).every((p) => !p.isForecast)).toBe(true);
    expect(result.slice(3).every((p) => p.isForecast)).toBe(true);
  });

  it('marks historical points with isForecast=false', () => {
    const series = [
      { date: '2024-01-01', value: 5 },
      { date: '2024-01-02', value: 10 },
      { date: '2024-01-03', value: 15 },
    ];
    const result = projectForecast(series, 2);
    expect(result[0].isForecast).toBe(false);
    expect(result[1].isForecast).toBe(false);
    expect(result[2].isForecast).toBe(false);
  });

  it('forecast points have lower and upper bounds', () => {
    const series = [
      { date: '2024-01-01', value: 10 },
      { date: '2024-01-02', value: 20 },
      { date: '2024-01-03', value: 30 },
    ];
    const result = projectForecast(series, 1);
    const forecast = result.find((p) => p.isForecast)!;
    expect(typeof forecast.lower).toBe('number');
    expect(typeof forecast.upper).toBe('number');
    expect(forecast.lower).toBeGreaterThanOrEqual(0);
    expect((forecast.upper as number) >= forecast.value).toBe(true);
  });

  it('forecast values are non-negative (clamped to 0)', () => {
    // Declining series may produce negative extrapolation
    const series = [
      { date: '2024-01-01', value: 30 },
      { date: '2024-01-02', value: 20 },
      { date: '2024-01-03', value: 10 },
    ];
    const result = projectForecast(series, 5);
    result.filter((p) => p.isForecast).forEach((p) => {
      expect(p.value).toBeGreaterThanOrEqual(0);
    });
  });
});
