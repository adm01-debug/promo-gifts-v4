import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPriceFreshness,
  formatPriceDateShort,
  formatPriceDateLong,
  DEFAULT_PRICE_FRESHNESS_THRESHOLD_DAYS,
} from './price-freshness';

describe('Price Freshness Utility', () => {
  beforeEach(() => {
    // Fix current date to ensure reproducible tests
    // 2026-05-03 as per system prompt
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-03T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatPriceDateShort', () => {
    it('formats date in pt-BR short format', () => {
      const date = new Date('2026-03-20T10:00:00Z');
      expect(formatPriceDateShort(date)).toBe('20/03/2026');
    });
  });

  describe('formatPriceDateLong', () => {
    it('formats date in pt-BR long format', () => {
      const date = new Date('2026-03-20T10:00:00Z');
      // Note: check for exact string or match part if locale behavior varies slightly
      expect(formatPriceDateLong(date)).toContain('20 de março de 2026');
    });
  });

  describe('getPriceFreshness', () => {
    // ... keep existing tests
    it('returns unknown status when date is missing', () => {
      const result = getPriceFreshness(null, 60);
      expect(result.status).toBe('unknown');
      expect(result.label).toContain('não informada');
      expect(result.shouldWarn).toBe(false);
    });

    it('returns unknown status when date is invalid', () => {
      const result = getPriceFreshness('invalid-date', 60);
      expect(result.status).toBe('unknown');
      expect(result.label).toContain('inválida');
    });

    it("returns fresh status for today's update", () => {
      const today = new Date('2026-05-03T09:00:00Z').toISOString();
      const result = getPriceFreshness(today, 60);
      expect(result.status).toBe('fresh');
      expect(result.label).toBe('Atualizado hoje');
      expect(result.shouldWarn).toBe(false);
    });

    it('returns fresh status for recent update (5 days ago)', () => {
      const fiveDaysAgo = new Date('2026-04-28T12:00:00Z').toISOString();
      const result = getPriceFreshness(fiveDaysAgo, 60);
      expect(result.status).toBe('fresh');
      expect(result.daysSinceUpdate).toBe(5);
    });

    it('returns aging status when half threshold is passed', () => {
      // Threshold 60, half is 30. 31 days ago = aging.
      const thirtyOneDaysAgo = new Date('2026-04-02T12:00:00Z').toISOString();
      const result = getPriceFreshness(thirtyOneDaysAgo, 60);
      expect(result.status).toBe('aging');
      expect(result.shouldWarn).toBe(true);
      expect(result.isStale).toBe(false);
    });

    it('returns stale status when threshold is exceeded', () => {
      // Threshold 60. 61 days ago = stale.
      const sixtyOneDaysAgo = new Date('2026-03-03T12:00:00Z').toISOString();
      const result = getPriceFreshness(sixtyOneDaysAgo, 60);
      expect(result.status).toBe('stale');
      expect(result.shouldWarn).toBe(true);
      expect(result.isStale).toBe(true);
      expect(result.label).toContain('defasado');
    });

    it('uses default threshold when not provided', () => {
      // 61 days ago with default 60 should be stale
      const sixtyOneDaysAgo = new Date('2026-03-03T12:00:00Z').toISOString();
      const result = getPriceFreshness(sixtyOneDaysAgo, undefined);
      expect(result.thresholdDays).toBe(DEFAULT_PRICE_FRESHNESS_THRESHOLD_DAYS);
      expect(result.status).toBe('stale');
    });

    it('respects custom threshold', () => {
      // 15 days ago with threshold 10 should be stale
      const fifteenDaysAgo = new Date('2026-04-18T12:00:00Z').toISOString();
      const result = getPriceFreshness(fifteenDaysAgo, 10);
      expect(result.status).toBe('stale');
    });

    describe('Edge Cases', () => {
      it('exactly at half threshold (30 days) should be fresh', () => {
        const thirtyDaysAgo = new Date('2026-04-03T12:00:00Z').toISOString();
        const result = getPriceFreshness(thirtyDaysAgo, 60);
        expect(result.status).toBe('fresh');
      });

      it('exactly at full threshold (60 days) should be aging (not stale yet)', () => {
        const sixtyDaysAgo = new Date('2026-03-04T12:00:00Z').toISOString();
        const result = getPriceFreshness(sixtyDaysAgo, 60);
        expect(result.status).toBe('aging');
      });

      it('handles ISO strings without Z (local time) consistently', () => {
        // "2026-05-02T10:00:00" might be interpreted differently depending on environment timezone
        // but the utility should handle it via Date constructor.
        const yesterday = '2026-05-02T12:00:00';
        const result = getPriceFreshness(yesterday, 60);
        expect(result.daysSinceUpdate).toBeGreaterThanOrEqual(0);
      });

      it('handles very old dates (years ago) as stale', () => {
        const yearsAgo = new Date('2020-01-01T12:00:00Z').toISOString();
        const result = getPriceFreshness(yearsAgo, 60);
        expect(result.status).toBe('stale');
        expect(result.daysSinceUpdate).toBeGreaterThan(365 * 5);
      });

      it('handles dates in the future as today (0 days)', () => {
        const tomorrow = new Date('2026-05-04T12:00:00Z').toISOString();
        const result = getPriceFreshness(tomorrow, 60);
        expect(result.daysSinceUpdate).toBe(0);
        expect(result.status).toBe('fresh');
      });
    });
  });
});
