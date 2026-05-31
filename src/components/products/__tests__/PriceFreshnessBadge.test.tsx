import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PriceFreshnessBadge } from '../PriceFreshnessBadge';
import { TooltipProvider } from '@/components/ui/tooltip';

describe('PriceFreshnessBadge Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-03T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderBadge = (props: any) => {
    return render(
      <TooltipProvider>
        <PriceFreshnessBadge {...props} />
      </TooltipProvider>
    );
  };

  it('renders "Atualizado em DD/MM/AAAA" for fresh status in PDP variant', () => {
    const date = new Date('2026-05-01T10:00:00Z'); // 2 days ago
    renderBadge({ priceUpdatedAt: date, variant: 'pdp' });
    
    expect(screen.getByText('Atualizado em 01/05/2026')).toBeInTheDocument();
  });

  it('renders correctly for aging status in PDP variant', () => {
    const date = new Date('2026-04-01T10:00:00Z'); // 32 days ago (with default 60 threshold)
    renderBadge({ priceUpdatedAt: date, variant: 'pdp' });
    
    expect(screen.getByText('Atualizado em 01/04/2026')).toBeInTheDocument();
  });

  it('renders "Data não informada" when date is missing in PDP variant', () => {
    renderBadge({ priceUpdatedAt: null, variant: 'pdp' });
    expect(screen.getByText('Data não informada')).toBeInTheDocument();
  });

  it('handles timezone offsets correctly', () => {
    // 2026-05-01T00:00:00-03:00 is 2026-05-01 03:00 UTC
    const date = new Date('2026-05-01T00:00:00-03:00');
    renderBadge({ priceUpdatedAt: date, variant: 'pdp' });
    
    expect(screen.getByText('Atualizado em 01/05/2026')).toBeInTheDocument();
  });

  it('verifies text at limit dates (threshold transition)', () => {
    const threshold = 10;
    
    // Exactly at threshold (10 days ago) -> Aging
    const tenDaysAgo = new Date('2026-04-23T12:00:00Z');
    renderBadge({ priceUpdatedAt: tenDaysAgo, thresholdDays: threshold, variant: 'pdp' });
    expect(screen.getByText('Atualizado em 23/04/2026')).toBeInTheDocument();

    // Just past threshold (11 days ago) -> Stale
    const elevenDaysAgo = new Date('2026-04-22T12:00:00Z');
    renderBadge({ priceUpdatedAt: elevenDaysAgo, thresholdDays: threshold, variant: 'pdp' });
    expect(screen.getByText('Atualizado em 22/04/2026')).toBeInTheDocument();
  });
});
