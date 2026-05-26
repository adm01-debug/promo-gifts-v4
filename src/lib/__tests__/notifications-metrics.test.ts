import { describe, it, expect, beforeEach } from 'vitest';
import { notificationsMetrics } from '../notifications-metrics';

describe('notifications-metrics regression tests', () => {
  beforeEach(() => {
    notificationsMetrics.reset();
  });

  it('should record triggers and update counts', () => {
    notificationsMetrics.recordTrigger('hover');
    notificationsMetrics.recordTrigger('focus');

    const snap = notificationsMetrics.snapshot();
    expect(snap.triggers).toBe(2);
    expect(snap.byTrigger.hover).toBe(1);
    expect(snap.byTrigger.focus).toBe(1);
    expect(snap.ratio).toBe(0);
  });

  it('should record fetches and calculate ratio correctly', () => {
    notificationsMetrics.recordTrigger('hover');
    notificationsMetrics.recordTrigger('hover');
    notificationsMetrics.recordFetch('prefetch');

    const snap = notificationsMetrics.snapshot();
    expect(snap.triggers).toBe(2);
    expect(snap.fetches).toBe(1);
    expect(snap.ratio).toBe(0.5);
  });

  it('should classify fetches within or after TTL correctly', async () => {
    // First fetch is always afterTtl
    notificationsMetrics.recordFetch('prefetch');
    let snap = notificationsMetrics.snapshot();
    expect(snap.fetchesByTtlWindow.afterTtl).toBe(1);
    expect(snap.fetchesByTtlWindow.withinTtl).toBe(0);

    // Immediate second fetch should be withinTtl
    notificationsMetrics.recordFetch('prefetch');
    snap = notificationsMetrics.snapshot();
    expect(snap.fetchesByTtlWindow.afterTtl).toBe(1);
    expect(snap.fetchesByTtlWindow.withinTtl).toBe(1);
  });

  it('should track badge render budget correctly', () => {
    notificationsMetrics.recordBadgeRender({
      source: 'cache',
      elapsedMs: 10, // Under 16ms budget
      cacheAgeMs: 100,
      networkMs: null,
      unreadCount: 5,
      hit: true, // although it will be recalculated by the method
    });

    notificationsMetrics.recordBadgeRender({
      source: 'network',
      elapsedMs: 200, // Over budget
      cacheAgeMs: null,
      networkMs: 180,
      unreadCount: 5,
      hit: false,
    });

    const snap = notificationsMetrics.snapshot();
    expect(snap.badgeBudget.hits).toBe(1);
    expect(snap.badgeBudget.misses).toBe(1);
    expect(snap.badgeBudget.byCache.hitRate).toBe(1);
    expect(snap.badgeBudget.byNetwork.hitRate).toBe(0);
  });

  it('should track trigger-to-fetch coalescing efficiency', () => {
    notificationsMetrics.recordTriggerToFetch({
      source: 'hover',
      debounceMs: 200,
      fetchMs: 100,
      coalescedTriggers: 5,
    });

    const snap = notificationsMetrics.snapshot();
    expect(snap.coalescingByTrigger.hover.triggers).toBe(5);
    expect(snap.coalescingByTrigger.hover.fetches).toBe(1);
    expect(snap.coalescingByTrigger.hover.saved).toBe(4);
    expect(snap.coalescingByTrigger.hover.efficiency).toBe(0.8);
  });
});
