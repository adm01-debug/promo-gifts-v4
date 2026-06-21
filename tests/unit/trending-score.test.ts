/**
 * Unit tests for the trending-score algorithm.
 *
 * The score normalises recentCount and baselineCount to daily rates so
 * windows of different lengths are comparable. Score == 1.0 means stable.
 */
import { describe, it, expect } from 'vitest';
import { calculateTrendingScore, calculateDelta } from '@/lib/trending-score';

// ─── calculateTrendingScore ────────────────────────────────────────────────────

describe('calculateTrendingScore', () => {
  describe('classification boundaries', () => {
    it('returns "rising" when ratio >= 1.3 (30 % daily growth)', () => {
      // 13 in 7 days vs 10 in 7 days → daily ratio = 1.3
      const r = calculateTrendingScore({
        recentCount: 13,
        baselineCount: 10,
        recentDays: 7,
        baselineDays: 7,
        totalVolume: 13,
      });
      expect(r.classification).toBe('rising');
    });

    it('returns "falling" when ratio <= 0.7 (30 % daily drop)', () => {
      const r = calculateTrendingScore({
        recentCount: 7,
        baselineCount: 10,
        recentDays: 7,
        baselineDays: 7,
        totalVolume: 7,
      });
      expect(r.classification).toBe('falling');
    });

    it('returns "stable" for ratio between 0.7 and 1.3', () => {
      const r = calculateTrendingScore({
        recentCount: 10,
        baselineCount: 10,
        recentDays: 7,
        baselineDays: 7,
        totalVolume: 10,
      });
      expect(r.classification).toBe('stable');
    });

    it('returns "new" when baselineCount is 0 but recentCount > 0', () => {
      const r = calculateTrendingScore({
        recentCount: 5,
        baselineCount: 0,
        recentDays: 7,
        baselineDays: 23,
        totalVolume: 5,
      });
      expect(r.classification).toBe('new');
      expect(r.growthPercent).toBe(Infinity);
    });
  });

  describe('"new" product score', () => {
    it('score is 2.0 when totalVolume is 0 (volume weight = 0)', () => {
      const r = calculateTrendingScore({
        recentCount: 1,
        baselineCount: 0,
        recentDays: 7,
        baselineDays: 23,
        totalVolume: 0,
      });
      expect(r.score).toBe(2.0);
    });

    it('score is 3.0 when totalVolume >= 5 (volume weight = 1)', () => {
      const r = calculateTrendingScore({
        recentCount: 5,
        baselineCount: 0,
        recentDays: 7,
        baselineDays: 23,
        totalVolume: 5,
      });
      expect(r.score).toBe(3.0);
    });

    it('score is 2.5 when totalVolume = 2.5 (half weight)', () => {
      const r = calculateTrendingScore({
        recentCount: 3,
        baselineCount: 0,
        recentDays: 7,
        baselineDays: 23,
        totalVolume: 2.5,
      });
      expect(r.score).toBeCloseTo(2.5, 5);
    });
  });

  describe('zero-data edge cases', () => {
    it('returns score 0 and stable when both counts are 0', () => {
      const r = calculateTrendingScore({
        recentCount: 0,
        baselineCount: 0,
        recentDays: 7,
        baselineDays: 23,
      });
      expect(r.score).toBe(0);
      expect(r.growthPercent).toBe(0);
      expect(r.classification).toBe('stable');
    });

    it('handles recentDays = 0 without dividing by zero', () => {
      // Should not throw; recentDaily becomes 0
      expect(() =>
        calculateTrendingScore({
          recentCount: 10,
          baselineCount: 5,
          recentDays: 0,
          baselineDays: 23,
        }),
      ).not.toThrow();
    });
  });

  describe('volume weight on normal products', () => {
    it('score is halved when recentCount = 0 (volume weight = 0)', () => {
      // ratio = 0 when recentDaily = 0 (recentCount = 0, baselineCount > 0)
      const r = calculateTrendingScore({
        recentCount: 0,
        baselineCount: 10,
        recentDays: 7,
        baselineDays: 7,
      });
      // ratio = 0, volumeWeight = 0, score = 0 * (0.5 + 0) = 0
      expect(r.score).toBe(0);
    });

    it('score is full ratio when recentCount >= 3 (volume weight = 1)', () => {
      // recentCount = 6, baselineCount = 6, equal windows → ratio = 1
      const r = calculateTrendingScore({
        recentCount: 6,
        baselineCount: 6,
        recentDays: 7,
        baselineDays: 7,
      });
      // ratio = 1, volumeWeight = min(6/3,1) = 1, score = 1*(0.5+0.5) = 1.0
      expect(r.score).toBeCloseTo(1.0, 5);
    });

    it('growthPercent reflects ratio correctly (50 % growth)', () => {
      const r = calculateTrendingScore({
        recentCount: 15,
        baselineCount: 10,
        recentDays: 7,
        baselineDays: 7,
      });
      expect(r.growthPercent).toBeCloseTo(50, 5);
    });

    it('normalises different window sizes correctly', () => {
      // 7 recent / 7 days = 1/day; 30 baseline / 30 days = 1/day → stable
      const r = calculateTrendingScore({
        recentCount: 7,
        baselineCount: 30,
        recentDays: 7,
        baselineDays: 30,
      });
      expect(r.classification).toBe('stable');
      expect(r.growthPercent).toBeCloseTo(0, 3);
    });
  });
});

// ─── calculateDelta ───────────────────────────────────────────────────────────

describe('calculateDelta', () => {
  it('returns null when both current and previous are 0', () => {
    expect(calculateDelta(0, 0)).toBeNull();
  });

  it('returns delta=100, direction="up" when previous is 0 and current > 0', () => {
    const r = calculateDelta(5, 0);
    expect(r).not.toBeNull();
    expect(r!.delta).toBe(100);
    expect(r!.direction).toBe('up');
    expect(r!.isSignificant).toBe(true);
  });

  it('calculates positive delta correctly (50 % increase)', () => {
    const r = calculateDelta(150, 100);
    expect(r!.delta).toBe(50);
    expect(r!.direction).toBe('up');
    expect(r!.isSignificant).toBe(true);
  });

  it('calculates negative delta correctly (25 % decrease)', () => {
    const r = calculateDelta(75, 100);
    expect(r!.delta).toBe(-25);
    expect(r!.direction).toBe('down');
    expect(r!.isSignificant).toBe(true);
  });

  it('direction is "neutral" for delta within ±0.5 %', () => {
    // 100.4 vs 100 → 0.4 % change → neutral
    const r = calculateDelta(100, 100);
    expect(r!.direction).toBe('neutral');
    expect(r!.isSignificant).toBe(false);
  });

  it('isSignificant is false when |delta| < 5 %', () => {
    const r = calculateDelta(103, 100); // 3 % change
    expect(r!.isSignificant).toBe(false);
  });

  it('isSignificant is true when |delta| >= 5 %', () => {
    const r = calculateDelta(105, 100); // exactly 5 %
    expect(r!.isSignificant).toBe(true);
  });

  it('rounds delta to one decimal place', () => {
    // 113 / 100 = 13.0 % exactly
    const r = calculateDelta(113, 100);
    expect(r!.delta).toBe(13);
  });

  it('handles a non-trivial rounding case', () => {
    // 106 / 100 → 6.0 %
    const r = calculateDelta(106, 100);
    expect(r!.delta).toBe(6);
  });
});
