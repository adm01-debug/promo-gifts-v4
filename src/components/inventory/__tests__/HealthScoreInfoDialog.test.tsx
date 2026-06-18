import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HealthScoreInfoDialog } from '../HealthScoreInfoDialog';

beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture = vi.fn(() => false);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.scrollIntoView = vi.fn();
});

describe('HealthScoreInfoDialog', () => {
  it('renders the trigger button initially with dialog closed', () => {
    render(<HealthScoreInfoDialog productsInStock={80} totalProducts={100} criticalAlerts={3} />);
    expect(screen.getByTestId('health-score-info-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('health-score-info-dialog')).not.toBeInTheDocument();
  });

  it('opens the dialog and shows the computed score (good band)', () => {
    render(<HealthScoreInfoDialog productsInStock={80} totalProducts={100} criticalAlerts={3} />);
    fireEvent.click(screen.getByTestId('health-score-info-trigger'));
    expect(screen.getByTestId('health-score-info-dialog')).toBeInTheDocument();
    // 80/100 → 80%
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByTestId('health-score-live-example')).toHaveTextContent('80 / 100');
  });

  it('shows the critical alerts count in the dialog', () => {
    render(<HealthScoreInfoDialog productsInStock={10} totalProducts={100} criticalAlerts={42} />);
    fireEvent.click(screen.getByTestId('health-score-info-trigger'));
    // 10/100 → 10%
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders all health bands and the thresholds legend', () => {
    render(<HealthScoreInfoDialog productsInStock={60} totalProducts={100} criticalAlerts={0} />);
    fireEvent.click(screen.getByTestId('health-score-info-trigger'));
    expect(screen.getByText('≥ 80% · saudável')).toBeInTheDocument();
    expect(screen.getByText('50% a 79% · atenção')).toBeInTheDocument();
    expect(screen.getByText('< 50% · crítico')).toBeInTheDocument();
    expect(screen.getByTestId('stock-thresholds-legend')).toBeInTheDocument();
  });

  it('handles zero total products (score defaults to 100)', () => {
    render(<HealthScoreInfoDialog productsInStock={0} totalProducts={0} criticalAlerts={0} />);
    fireEvent.click(screen.getByTestId('health-score-info-trigger'));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
