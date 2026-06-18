/**
 * Validação exaustiva da lógica de "Novidade X dias" do ProductCardImage.
 * Reproduz a mesma fórmula usada no componente para travar contrato.
 */
import { describe, it, expect } from 'vitest';
import { resolveNoveltyDaysRemaining, noveltyBadgeLabel as badgeLabel } from '@/lib/products/novelty-days';

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

describe('Novelty badge — resolveNoveltyDaysRemaining', () => {
  it('uses explicit noveltyDaysRemaining when provided', () => {
    expect(resolveNoveltyDaysRemaining(daysAgo(10), 7, true)).toBe(7);
  });

  it('returns undefined when newArrival false and no explicit value', () => {
    expect(resolveNoveltyDaysRemaining(daysAgo(5), undefined, false)).toBeUndefined();
  });

  it('returns undefined when created_at missing and no explicit value', () => {
    expect(resolveNoveltyDaysRemaining(null, undefined, true)).toBeUndefined();
    expect(resolveNoveltyDaysRemaining(undefined, undefined, true)).toBeUndefined();
  });

  it('returns undefined when created_at is unparseable', () => {
    expect(resolveNoveltyDaysRemaining('not-a-date', undefined, true)).toBeUndefined();
  });

  it.each([
    [0, 30, 'Novidade hoje!'],
    [1, 29, 'Novidade 1 dia'],
    [5, 25, 'Novidade 5 dias'],
    [15, 15, 'Novidade 15 dias'],
    [29, 1, 'Novidade 29 dias'],
  ])('created %i days ago → remaining=%i → "%s"', (created, expectedRemaining, expectedLabel) => {
    const remaining = resolveNoveltyDaysRemaining(daysAgo(created), undefined, true);
    expect(remaining).toBe(expectedRemaining);
    expect(badgeLabel(remaining)).toBe(expectedLabel);
  });

  it('drops badge when product is older than 30 days', () => {
    expect(resolveNoveltyDaysRemaining(daysAgo(30), undefined, true)).toBeUndefined();
    expect(resolveNoveltyDaysRemaining(daysAgo(45), undefined, true)).toBeUndefined();
    expect(resolveNoveltyDaysRemaining(daysAgo(365), undefined, true)).toBeUndefined();
  });

  it('ignores future dates (negative elapsed)', () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    // elapsed = -5 → remaining = 35 → fora da janela [1..30] → undefined
    expect(resolveNoveltyDaysRemaining(future, undefined, true)).toBeUndefined();
  });

  it('hundreds of simulations: monotonic — remaining decreases as age grows', () => {
    let prev = Infinity;
    for (let age = 0; age <= 29; age++) {
      const r = resolveNoveltyDaysRemaining(daysAgo(age), undefined, true);
      expect(r).toBeDefined();
      expect(r! <= prev).toBe(true);
      prev = r!;
    }
  });

  it('fuzz 500 ages: never NaN, never > 30, never < 1 when defined', () => {
    for (let i = 0; i < 500; i++) {
      const age = Math.floor(Math.random() * 60);
      const r = resolveNoveltyDaysRemaining(daysAgo(age), undefined, true);
      if (r !== undefined) {
        expect(Number.isFinite(r)).toBe(true);
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(30);
      }
    }
  });

  it('badge label fallback when daysRemaining undefined → "Novidade hoje!"', () => {
    expect(badgeLabel(undefined)).toBe('Novidade hoje!');
  });
});
