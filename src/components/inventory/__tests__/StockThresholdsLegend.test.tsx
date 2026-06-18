import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StockThresholdsLegend } from '../StockThresholdsLegend';
import { STOCK_THRESHOLD_RULES } from '@/lib/inventory/health-score';

describe('StockThresholdsLegend', () => {
  it('renders the legend container with a chip per threshold rule', () => {
    render(<StockThresholdsLegend />);
    expect(screen.getByTestId('stock-thresholds-legend')).toBeInTheDocument();
    for (const rule of STOCK_THRESHOLD_RULES) {
      expect(screen.getByTestId(`stock-threshold-chip-${rule.key}`)).toBeInTheDocument();
      expect(screen.getByText(rule.label)).toBeInTheDocument();
    }
  });

  it('shows the heading label when not compact', () => {
    render(<StockThresholdsLegend />);
    expect(screen.getByText('Faixas de classificação:')).toBeInTheDocument();
  });

  it('hides the heading label when compact', () => {
    render(<StockThresholdsLegend compact />);
    expect(screen.queryByText('Faixas de classificação:')).not.toBeInTheDocument();
  });

  it('applies a custom className to the container', () => {
    render(<StockThresholdsLegend className="my-legend" />);
    expect(screen.getByTestId('stock-thresholds-legend').className).toContain('my-legend');
  });

  it('sets the rule text as the title attribute of each chip', () => {
    render(<StockThresholdsLegend />);
    const first = STOCK_THRESHOLD_RULES[0];
    expect(screen.getByTestId(`stock-threshold-chip-${first.key}`)).toHaveAttribute(
      'title',
      first.rule,
    );
  });
});
