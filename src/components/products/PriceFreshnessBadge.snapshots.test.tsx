import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PriceFreshnessBadge } from './PriceFreshnessBadge';

// Mock Tooltip components to avoid Radix dependencies and make tests deterministic
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('PriceFreshnessBadge Snapshots and A11y', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-03T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const dates = {
    fresh: new Date('2026-05-03T09:00:00Z').toISOString(),
    aging: new Date('2026-04-02T12:00:00Z').toISOString(), // 31 days ago
    stale: new Date('2026-03-03T12:00:00Z').toISOString(), // 61 days ago
    unknown: null,
  };

  const variants = ['inline', 'compact', 'pdp', 'icon-only'] as const;

  describe('Snapshots', () => {
    // T-FIX-4: refatorado de forEach aninhado para it.each com produto
    // cartesiano (variants × statuses). Cada par é registrado como teste
    // isolado. Usamos tuple style + %s para preservar o nome original
    // dos testes (e os snapshots existentes não viram obsoletos).
    type SnapshotCase = [(typeof variants)[number], string, string | null];
    const snapshotCases: SnapshotCase[] = variants.flatMap((variant) =>
      Object.entries(dates).map(([status, date]): SnapshotCase => [variant, status, date]),
    );

    it.each(snapshotCases)(
      'matches snapshot for %s variant with %s status',
      (variant, _status, date) => {
        const { asFragment } = render(
          <PriceFreshnessBadge priceUpdatedAt={date} variant={variant} alwaysShow />,
        );
        expect(asFragment()).toMatchSnapshot();
      },
    );

    it('matches snapshot for confirmed state', () => {
      const now = new Date('2026-05-03T12:00:00Z').toISOString();
      const { asFragment } = render(
        <PriceFreshnessBadge priceUpdatedAt={dates.stale} confirmedAt={now} variant="inline" />,
      );
      expect(asFragment()).toMatchSnapshot();
    });
  });

  describe('Accessibility', () => {
    it('has correct aria-label and role for warning states', () => {
      const { getByRole } = render(
        <PriceFreshnessBadge priceUpdatedAt={dates.stale} variant="icon-only" />,
      );
      const badge = getByRole('status');
      expect(badge).toHaveAttribute('aria-label');
      expect(badge.getAttribute('aria-label')).toContain('Atenção: preço possivelmente defasado');
    });

    it('is keyboard focusable in compact/icon-only variants', () => {
      const { getByRole } = render(
        <PriceFreshnessBadge priceUpdatedAt={dates.aging} variant="icon-only" />,
      );
      const badge = getByRole('status');
      expect(badge).toHaveAttribute('tabIndex', '0');
    });

    it('uses aria-hidden on icons to avoid redundant screen reader noise', () => {
      const { container } = render(
        <PriceFreshnessBadge priceUpdatedAt={dates.fresh} variant="inline" />,
      );
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
