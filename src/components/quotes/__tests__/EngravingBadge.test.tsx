import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EngravingBadge } from '../EngravingBadge';

describe('EngravingBadge', () => {
  it('renderiza título e meta em dois blocos separados', () => {
    render(<EngravingBadge title="Fiber Laser | Plana" meta="Lado A · 3×5 cm · 1 cor" />);
    const title = screen.getByTestId('engraving-badge-title');
    const meta = screen.getByTestId('engraving-badge-meta');
    expect(title).toHaveTextContent('✦ Fiber Laser | Plana');
    expect(meta).toHaveTextContent('Lado A · 3×5 cm · 1 cor');
    // Título e meta são elementos irmãos (2 linhas via flex-col no pai)
    expect(title.parentElement).toBe(meta.parentElement);
    expect(title.parentElement?.className).toMatch(/flex-col/);
  });

  it('omite o bloco de meta quando não há metadados', () => {
    render(<EngravingBadge title="Bordado" />);
    expect(screen.getByTestId('engraving-badge-title')).toBeInTheDocument();
    expect(screen.queryByTestId('engraving-badge-meta')).toBeNull();
  });

  it('inclui título e meta no atributo title (tooltip nativo)', () => {
    render(<EngravingBadge title="Serigrafia" meta="Frente · 10×4 cm · 1 cor" />);
    expect(screen.getByTestId('engraving-badge')).toHaveAttribute(
      'title',
      'Serigrafia — Frente · 10×4 cm · 1 cor',
    );
  });

  it('permite marker customizado', () => {
    render(<EngravingBadge title="UV" marker="●" />);
    expect(screen.getByTestId('engraving-badge-title')).toHaveTextContent('● UV');
  });

  it('renderiza location como pílula antes do título', () => {
    render(<EngravingBadge title="Serigrafia" location="Lado A" meta="1 cor" />);
    const title = screen.getByTestId('engraving-badge-title');
    expect(title).toHaveTextContent('Lado A');
    expect(title).toHaveTextContent('Serigrafia');
  });

  it('variant plain remove borda/fundo mas mantém layout 2 linhas', () => {
    render(
      <EngravingBadge variant="plain" title="Bordado" meta="Frente · 1 cor" />,
    );
    const badge = screen.getByTestId('engraving-badge');
    expect(badge).toHaveAttribute('data-variant', 'plain');
    expect(badge.className).toMatch(/flex-col/);
    expect(badge.className).not.toMatch(/bg-primary\/10/);
    // Sem marker ✦ no variant plain
    expect(screen.getByTestId('engraving-badge-title').textContent).not.toContain('✦');
    // Meta segue como segundo bloco
    expect(screen.getByTestId('engraving-badge-meta')).toBeInTheDocument();
  });
});
