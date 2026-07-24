import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Flame } from 'lucide-react';
import { RiskKpi } from '../RiskKpi';

describe('RiskKpi', () => {
  it('renders label, value and sub text', () => {
    render(<RiskKpi icon={Flame} label="Risco" value="12" sub="produtos" />);
    expect(screen.getByText('Risco')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('produtos')).toBeInTheDocument();
  });

  it('has role status', () => {
    render(<RiskKpi icon={Flame} label="Risco" value="0" sub="ok" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies neutral styling by default (no alert/warning)', () => {
    render(<RiskKpi icon={Flame} label="Risco" value="3" sub="x" />);
    const root = screen.getByRole('status');
    expect(root.className).toContain('bg-muted/50');
    expect(root.className).not.toContain('bg-destructive/10');
    expect(root.className).not.toContain('bg-warning/10');
  });

  it('applies alert (destructive) styling when alert is true', () => {
    render(<RiskKpi icon={Flame} label="Crítico" value="9" sub="x" alert />);
    const root = screen.getByRole('status');
    expect(root.className).toContain('bg-destructive/10');
  });

  it('applies warning styling when warning is true', () => {
    render(<RiskKpi icon={Flame} label="Atenção" value="4" sub="x" warning />);
    const root = screen.getByRole('status');
    expect(root.className).toContain('bg-warning/10');
  });

  it('prioritizes alert over warning when both are set', () => {
    render(<RiskKpi icon={Flame} label="Both" value="1" sub="x" alert warning />);
    const root = screen.getByRole('status');
    expect(root.className).toContain('bg-destructive/10');
    expect(root.className).not.toContain('bg-warning/10');
  });
});
