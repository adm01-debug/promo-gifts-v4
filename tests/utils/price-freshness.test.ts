import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  getPriceFreshness,
  formatPriceDateShort,
  formatPriceDateLong,
  DEFAULT_PRICE_FRESHNESS_THRESHOLD_DAYS,
} from "@/utils/price-freshness";

const FIXED_NOW = new Date("2026-05-03T12:00:00.000Z").getTime();

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

function daysAgo(days: number): string {
  return new Date(FIXED_NOW - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("formatPriceDateShort", () => {
  it("formats date in pt-BR short format (DD/MM/AAAA)", () => {
    const date = new Date("2026-03-20T10:00:00Z");
    expect(formatPriceDateShort(date)).toBe("20/03/2026");
  });

  it("handles different timezones consistently for short format", () => {
    const offsetDate = new Date("2026-05-01T00:00:00-03:00");
    expect(formatPriceDateShort(offsetDate)).toBe("01/05/2026");
  });
});

describe("formatPriceDateLong", () => {
  it("formats date in pt-BR long format", () => {
    const date = new Date("2026-03-20T10:00:00Z");
    expect(formatPriceDateLong(date)).toContain("20 de março de 2026");
  });
});

describe("getPriceFreshness", () => {
  it("returns 'unknown' when priceUpdatedAt is null/undefined", () => {
    const r1 = getPriceFreshness(null, 60);
    const r2 = getPriceFreshness(undefined, 60);
    expect(r1.status).toBe("unknown");
    expect(r1.daysSinceUpdate).toBeNull();
    expect(r1.shouldWarn).toBe(false);
  });

  it("returns 'unknown' for invalid date strings", () => {
    const r = getPriceFreshness("not-a-date", 60);
    expect(r.status).toBe("unknown");
  });

  it("returns 'fresh' when within 50% of threshold", () => {
    const r = getPriceFreshness(daysAgo(10), 60);
    expect(r.status).toBe("fresh");
    expect(r.daysSinceUpdate).toBe(10);
    expect(r.shouldWarn).toBe(false);
  });

  it("returns 'stale' exactly at threshold limit (100%) — BUG-008: days >= threshold", () => {
    const r = getPriceFreshness(daysAgo(60), 60);
    expect(r.status).toBe("stale");
    expect(r.shouldWarn).toBe(true);
    expect(r.isStale).toBe(true);
  });

  it("returns 'stale' when just above threshold", () => {
    const r = getPriceFreshness(daysAgo(61), 60);
    expect(r.status).toBe("stale");
    expect(r.shouldWarn).toBe(true);
    expect(r.isStale).toBe(true);
  });

  it("uses default threshold of 60 days when not provided", () => {
    const r = getPriceFreshness(daysAgo(10), null);
    expect(r.thresholdDays).toBe(DEFAULT_PRICE_FRESHNESS_THRESHOLD_DAYS);
  });

  it("respects custom thresholds", () => {
    expect(getPriceFreshness(daysAgo(20), 30).status).toBe("aging");
    expect(getPriceFreshness(daysAgo(40), 30).status).toBe("stale");
  });

  it("clamps future dates to 0 days", () => {
    const future = new Date(FIXED_NOW + 86400000).toISOString();
    const r = getPriceFreshness(future, 60);
    expect(r.daysSinceUpdate).toBe(0);
    expect(r.status).toBe("fresh");
  });

  // BUG-008 boundary sentinel: day == threshold MUST be 'stale' (>=), and the
  // day before must NOT be stale. Locks the policy the 6 suites drifted from.
  it.each([1, 2, 15, 30, 60, 90, 365])(
    "threshold=%i: day==threshold -> 'stale'; day-1 -> not stale; day+1 -> 'stale'",
    (t) => {
      expect(getPriceFreshness(daysAgo(t), t).status).toBe("stale");
      expect(getPriceFreshness(daysAgo(t + 1), t).status).toBe("stale");
      expect(
        getPriceFreshness(daysAgo(Math.max(0, t - 1)), t).status,
      ).not.toBe("stale");
    },
  );
});
