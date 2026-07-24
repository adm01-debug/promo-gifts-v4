import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthBrandingPanel } from '@/pages/auth/AuthBranding';
import { BrowserRouter } from 'react-router-dom';

// Mock components and icons
vi.mock('lucide-react', () => ({
  Rocket: () => <div />,
  Gift: () => <div />,
  Package: () => <div />,
  Factory: () => <div />,
  SlidersHorizontal: () => <div />,
  Brain: () => <div />,
  CheckCircle2: () => <div />,
  RotateCw: () => <div />,
}));

vi.mock('@/components/layout/AppLogo', () => ({
  AppLogo: () => <div data-testid="app-logo" />,
}));

describe('AuthBrandingPanel Visual Classes', () => {
  it('has correct responsive width and margin classes on the grid container', () => {
    const { container } = render(
      <BrowserRouter>
        <AuthBrandingPanel />
      </BrowserRouter>,
    );

    const grid = container.querySelector('.grid-cols-2');
    expect(grid).toBeInTheDocument();

    const classes = grid?.className ?? '';
    // Layout atual do painel: grid full-width, sem overflow lateral (-mx) do design antigo.
    expect(classes).toContain('w-full');
  });

  it('has correct padding and gap classes', () => {
    const { container } = render(
      <BrowserRouter>
        <AuthBrandingPanel />
      </BrowserRouter>,
    );

    const grid = container.querySelector('.grid-cols-2');
    expect(grid?.className).toContain('gap-3');
    expect(grid?.className).toContain('sm:gap-5');

    const cards = container.querySelectorAll('.rounded-3xl');
    expect(cards.length).toBeGreaterThan(0);
    // T-FIX-5b — decisão Opção A (eslint-disable cirúrgico):
    //
    // Os ~6 cards são DOM nodes do mesmo render() (não dados estáticos
    // isoláveis em it.each). O masking aqui tem alcance pequeno:
    // todos os cards são inspecionados antes do usuário ver a página,
    // e quebra de uma classe Tailwind tipicamente vem da mesma causa
    // (ex: design system regressou px-5 globalmente → todos falham juntos).
    //
    // Custo de refactor para it.each é alto: exigiria N renders separados
    // ou um helper de setup compartilhado. Diferente do caso Rose Quartz
    // (26 presets isolados com falhas independentes possíveis), aqui o
    // risco residual é aceitável.
    //
    // Se algum dia este forEach mascarar bug real, refatorar nesse momento
    // com motivo concreto. Decisão registrada em docs/redeploy/T-FIX-5-LINT-GUARDRAIL.md.
    //
    // Update 2026-05-23: o eslint-disable original tornou-se órfão após
    // refinamento da regra no(s) commit(s) e0f1315/73c2efa — a `no-restricted-syntax`
    // atual só flagga forEach que contém it/test/describe (anti-padrão A),
    // não forEach+expect (anti-padrão B, não ativado). Diretiva removida
    // para zerar o WARN "Unused eslint-disable directive" no gate
    // lint:baseline. Se T-FIX-5b for ativado depois, reintroduzir.
    expect(cards).not.toHaveLength(0);
    for (const card of cards) {
      expect(card.className).toContain('px-5');
      expect(card.className).toContain('h-[88px]');
    }
  });

  it('is visible on all screens with responsive width', () => {
    const { container } = render(
      <BrowserRouter>
        <AuthBrandingPanel />
      </BrowserRouter>,
    );

    const mainDiv = container.firstChild as HTMLElement;
    const classes = mainDiv.className.split(' ');
    expect(classes).toContain('flex');
    expect(classes).not.toContain('hidden');
    expect(classes).toContain('w-full');
    expect(classes).toContain('lg:w-1/2');
  });
});
