/**
 * Unit tests for src/lib/novelty-dates.ts
 *
 * formatDaysAgoFromTs, formatDaysAgoFromCount, getRecencyVariant
 */
import { describe, it, expect } from 'vitest';
import {
  formatDaysAgoFromTs,
  formatDaysAgoFromCount,
  getRecencyVariant,
} from '@/lib/novelty-dates';

const MS_PER_DAY = 86_400_000;

// ============================================
// formatDaysAgoFromTs
// ============================================

describe('formatDaysAgoFromTs', () => {
  it('returns "Hoje!" for a timestamp less than 24 hours ago', () => {
    const ts = new Date(Date.now() - 3600_000); // 1 hour ago
    expect(formatDaysAgoFromTs(ts)).toBe('Hoje!');
  });

  it('returns "Hoje!" for the current moment', () => {
    expect(formatDaysAgoFromTs(new Date())).toBe('Hoje!');
  });

  it('returns "Ontem" for a timestamp 1.5 days ago (floor=1)', () => {
    const ts = new Date(Date.now() - MS_PER_DAY * 1.5);
    expect(formatDaysAgoFromTs(ts)).toBe('Ontem');
  });

  it('returns "Nd atrás" for N days ago', () => {
    const ts = new Date(Date.now() - MS_PER_DAY * 5);
    expect(formatDaysAgoFromTs(ts)).toBe('5d atrás');
  });

  it('accepts an ISO string', () => {
    const iso = new Date(Date.now() - MS_PER_DAY * 10).toISOString();
    expect(formatDaysAgoFromTs(iso)).toBe('10d atrás');
  });

  it('accepts a unix timestamp number', () => {
    const ts = Date.now() - MS_PER_DAY * 3;
    expect(formatDaysAgoFromTs(ts)).toBe('3d atrás');
  });

  it('accepts a Date object directly', () => {
    const d = new Date(Date.now() - MS_PER_DAY * 7);
    expect(formatDaysAgoFromTs(d)).toBe('7d atrás');
  });
});

// ============================================
// formatDaysAgoFromCount
// ============================================

describe('formatDaysAgoFromCount', () => {
  it('returns "Hoje!" for 0 days', () => {
    expect(formatDaysAgoFromCount(0)).toBe('Hoje!');
  });

  it('returns "Ontem" for 1 day', () => {
    expect(formatDaysAgoFromCount(1)).toBe('Ontem');
  });

  it('returns "Nd atrás" for N > 1', () => {
    expect(formatDaysAgoFromCount(2)).toBe('2d atrás');
    expect(formatDaysAgoFromCount(30)).toBe('30d atrás');
    expect(formatDaysAgoFromCount(365)).toBe('365d atrás');
  });

  it('uses the count as-is without rounding', () => {
    expect(formatDaysAgoFromCount(7)).toBe('7d atrás');
  });
});

// ============================================
// getRecencyVariant
// ============================================

describe('getRecencyVariant', () => {
  it('returns "hot" for today (0 days ago)', () => {
    expect(getRecencyVariant(new Date())).toBe('hot');
  });

  it('returns "hot" for 1 day ago', () => {
    expect(getRecencyVariant(new Date(Date.now() - MS_PER_DAY))).toBe('hot');
  });

  it('returns "hot" for exactly 2 days ago (boundary)', () => {
    expect(getRecencyVariant(new Date(Date.now() - MS_PER_DAY * 2))).toBe('hot');
  });

  it('returns "warm" for 3 days ago', () => {
    expect(getRecencyVariant(new Date(Date.now() - MS_PER_DAY * 3))).toBe('warm');
  });

  it('returns "warm" for exactly 5 days ago (boundary)', () => {
    expect(getRecencyVariant(new Date(Date.now() - MS_PER_DAY * 5))).toBe('warm');
  });

  it('returns "normal" for 6 days ago', () => {
    expect(getRecencyVariant(new Date(Date.now() - MS_PER_DAY * 6))).toBe('normal');
  });

  it('returns "normal" for old dates', () => {
    expect(getRecencyVariant(new Date(Date.now() - MS_PER_DAY * 30))).toBe('normal');
    expect(getRecencyVariant(new Date(Date.now() - MS_PER_DAY * 365))).toBe('normal');
  });

  it('accepts ISO string', () => {
    const iso = new Date(Date.now() - MS_PER_DAY).toISOString();
    expect(getRecencyVariant(iso)).toBe('hot');
  });
});
