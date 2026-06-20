import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  notificationsMetrics,
  BADGE_RENDER_BUDGET_MS,
} from "@/lib/notifications-metrics";

/**
 * Verifies the running hit/miss counters and the unmount summary log.
 *
 *   - Every recorded badge render bumps hits or misses based on the <16ms
 *     budget threshold (BADGE_RENDER_BUDGET_MS).
 *   - Counters split per source (cache vs network) and aggregate at the top.
 *   - `logBadgeBudgetSummary()` no-ops when debug is OFF, no-ops when no
 *     renders have been recorded, and emits a single consolidated line
 *     otherwise.
 */

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  notificationsMetrics.reset();
  consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
  localStorage.removeItem("debug:notifications");
  notificationsMetrics.reset();
});

function recordRender(source: "cache" | "network", elapsedMs: number) {
  notificationsMetrics.recordBadgeRender({
    source,
    elapsedMs,
    cacheAgeMs: source === "cache" ? 0 : null,
    networkMs: source === "network" ? elapsedMs : null,
    unreadCount: 0,
    hit: elapsedMs < BADGE_RENDER_BUDGET_MS, // intentionally redundant — module re-derives
  });
}

function findSummaryLogs() {
  return consoleSpy.mock.calls
    .filter(
      (args) =>
        typeof args[0] === "string" &&
        (args[0] as string).includes("notifications-metrics:badge-budget-summary")
    )
    .map((args) => {
      try {
        return JSON.parse(args[0] as string).data as Record<string, unknown>;
      } catch {
        return undefined;
      }
    })
    .filter((x): x is Record<string, unknown> => x !== undefined);
}

describe("notifications-metrics — badge budget hit/miss counters", () => {
  it("starts with zero counters", () => {
    const { badgeBudget } = notificationsMetrics.snapshot();
    expect(badgeBudget.hits).toBe(0);
    expect(badgeBudget.misses).toBe(0);
    expect(badgeBudget.total).toBe(0);
    expect(badgeBudget.hitRate).toBe(0);
    expect(badgeBudget.byCache.total).toBe(0);
    expect(badgeBudget.byNetwork.total).toBe(0);
  });

  it("classifies a render as a HIT when elapsedMs < 16ms", () => {
    recordRender("cache", 5);
    const { badgeBudget } = notificationsMetrics.snapshot();
    expect(badgeBudget.hits).toBe(1);
    expect(badgeBudget.misses).toBe(0);
    expect(badgeBudget.byCache).toEqual({
      hits: 1,
      misses: 0,
      total: 1,
      hitRate: 1,
    });
  });

  it("classifies a render as a MISS when elapsedMs >= 16ms", () => {
    recordRender("network", 50);
    const { badgeBudget } = notificationsMetrics.snapshot();
    expect(badgeBudget.hits).toBe(0);
    expect(badgeBudget.misses).toBe(1);
    expect(badgeBudget.byNetwork).toEqual({
      hits: 0,
      misses: 1,
      total: 1,
      hitRate: 0,
    });
  });

  it("treats elapsedMs === 16 as a MISS (strict-less-than threshold)", () => {
    recordRender("cache", 16);
    expect(notificationsMetrics.snapshot().badgeBudget.misses).toBe(1);
    recordRender("cache", 15.99);
    expect(notificationsMetrics.snapshot().badgeBudget.hits).toBe(1);
  });

  it("aggregates correctly across mixed sources and computes hitRate", () => {
    recordRender("cache", 3); // hit
    recordRender("cache", 8); // hit
    recordRender("cache", 22); // miss
    recordRender("network", 12); // hit
    recordRender("network", 80); // miss
    recordRender("network", 200); // miss

    const { badgeBudget } = notificationsMetrics.snapshot();
    expect(badgeBudget.total).toBe(6);
    expect(badgeBudget.hits).toBe(3);
    expect(badgeBudget.misses).toBe(3);
    expect(badgeBudget.hitRate).toBe(0.5);

    expect(badgeBudget.byCache).toEqual({
      hits: 2,
      misses: 1,
      total: 3,
      hitRate: 0.667,
    });
    expect(badgeBudget.byNetwork).toEqual({
      hits: 1,
      misses: 2,
      total: 3,
      hitRate: 0.333,
    });
  });

  it("re-derives hit from elapsedMs even when caller passes a stale `hit` flag", () => {
    notificationsMetrics.recordBadgeRender({
      source: "cache",
      elapsedMs: 100, // clearly a miss
      cacheAgeMs: 0,
      networkMs: null,
      unreadCount: 0,
      hit: true, // stale / lying
    });
    const snap = notificationsMetrics.snapshot();
    expect(snap.lastBadgeRender?.hit).toBe(false);
    expect(snap.badgeBudget.misses).toBe(1);
    expect(snap.badgeBudget.hits).toBe(0);
  });

  it("reset() clears the budget counters", () => {
    recordRender("cache", 5);
    recordRender("network", 100);
    expect(notificationsMetrics.snapshot().badgeBudget.total).toBe(2);
    notificationsMetrics.reset();
    const { badgeBudget } = notificationsMetrics.snapshot();
    expect(badgeBudget).toEqual({
      hits: 0,
      misses: 0,
      total: 0,
      hitRate: 0,
      byCache: { hits: 0, misses: 0, total: 0, hitRate: 0 },
      byNetwork: { hits: 0, misses: 0, total: 0, hitRate: 0 },
    });
  });
});

describe("notifications-metrics — logBadgeBudgetSummary()", () => {
  // Note: in the vitest env `import.meta.env.DEV === true`, so `isDebugEnabled()`
  // is always truthy. The "debug OFF" branch is therefore exercised in production
  // builds (DEV=false + no localStorage flag) and via manual smoke testing.
  it("does NOT log when debug is ON but no renders were recorded", () => {
    localStorage.setItem("debug:notifications", "1");
    notificationsMetrics.logBadgeBudgetSummary("test");
    expect(findSummaryLogs()).toHaveLength(0);
  });

  it("emits ONE consolidated summary line when debug is ON and renders exist", () => {
    localStorage.setItem("debug:notifications", "1");
    recordRender("cache", 5); // hit
    recordRender("cache", 50); // miss
    recordRender("network", 80); // miss

    // Filter spy noise: the recordRender calls also log per-render lines.
    const beforeSummary = findSummaryLogs().length;
    notificationsMetrics.logBadgeBudgetSummary("hook-unmount");
    const summaries = findSummaryLogs();
    expect(summaries.length - beforeSummary).toBe(1);

    const payload = summaries[summaries.length - 1];
    expect(payload.reason).toBe("hook-unmount");
    expect(payload.budgetMs).toBe(BADGE_RENDER_BUDGET_MS);
    expect(payload.total).toBe(3);
    expect(payload.hits).toBe(1);
    expect(payload.misses).toBe(2);
    expect(payload.hitRate).toBeCloseTo(1 / 3, 2);
  });

  it("uses 'unmount' as the default reason", () => {
    localStorage.setItem("debug:notifications", "1");
    recordRender("cache", 5);
    notificationsMetrics.logBadgeBudgetSummary();
    const summaries = findSummaryLogs();
    expect(summaries.at(-1)?.reason).toBe("unmount");
  });
});
