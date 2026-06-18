import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskTooltip } from '../RiskTooltip';

const point = (over: Record<string, unknown> = {}) => ({
  payload: {
    fullDate: '15/06/2026',
    stockClose: 1234,
    depleted: null,
    restocked: null,
    restockDetected: false,
    ...over,
  },
});

describe('RiskTooltip', () => {
  it('renders nothing when inactive', () => {
    const { container } = render(<RiskTooltip active={false} payload={[point()]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when payload is empty', () => {
    const { container } = render(<RiskTooltip active payload={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when payload is missing', () => {
    const { container } = render(<RiskTooltip active />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the date and formatted current stock when active', () => {
    render(<RiskTooltip active payload={[point({ stockClose: 1234 })]} />);
    expect(screen.getByText('15/06/2026')).toBeInTheDocument();
    expect(screen.getByText('Estoque Atual')).toBeInTheDocument();
    expect(screen.getByText('1.234')).toBeInTheDocument();
  });

  it('shows an em dash when stockClose is not a number', () => {
    render(<RiskTooltip active payload={[point({ stockClose: null })]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows depleted (Saídas) only when positive', () => {
    render(<RiskTooltip active payload={[point({ depleted: 50 })]} />);
    expect(screen.getByText('Saídas')).toBeInTheDocument();
    expect(screen.getByText('-50')).toBeInTheDocument();
    expect(screen.queryByText('Entradas')).not.toBeInTheDocument();
  });

  it('shows restocked (Entradas) only when positive', () => {
    render(<RiskTooltip active payload={[point({ restocked: 80 })]} />);
    expect(screen.getByText('Entradas')).toBeInTheDocument();
    expect(screen.getByText('+80')).toBeInTheDocument();
    expect(screen.queryByText('Saídas')).not.toBeInTheDocument();
  });

  it('shows the restock-detected badge when restockDetected is true', () => {
    render(<RiskTooltip active payload={[point({ restockDetected: true })]} />);
    expect(screen.getByText('Reposição Detectada')).toBeInTheDocument();
  });

  it('hides movement section when neither depleted nor restocked', () => {
    render(<RiskTooltip active payload={[point()]} />);
    expect(screen.queryByText('Saídas')).not.toBeInTheDocument();
    expect(screen.queryByText('Entradas')).not.toBeInTheDocument();
  });
});
