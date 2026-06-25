import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuoteBuilderStepper } from '../QuoteBuilderStepper';
import React from 'react';
import type * as LucideReact from 'lucide-react';

// Mocking icons to simplify snapshot/queries
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual<typeof LucideReact>('lucide-react');
  return {
    ...actual,
    Building2: () => <div data-testid="icon-client" />,
    CreditCard: () => <div data-testid="icon-conditions" />,
    Package: () => <div data-testid="icon-items" />,
    Sparkles: () => <div data-testid="icon-personalization" />,
    FileCheck: () => <div data-testid="icon-review" />,
    Check: () => <div data-testid="icon-check" />,
  };
});

describe('QuoteBuilderStepper UI (5 etapas)', () => {
  it('highlights active step with standardized size (no ring inflation)', () => {
    render(<QuoteBuilderStepper completedSteps={[]} activeStep="client" />);

    const clientStep = screen.getByText('Cliente').parentElement?.querySelector('.rounded-full');
    expect(clientStep?.className).toContain('bg-primary');
    expect(clientStep?.className).toContain('text-primary-foreground');
    // Padronização: ativo NÃO pode ter ring-4 (causava círculo maior que os demais)
    expect(clientStep?.className).not.toContain('ring-4');
    expect(clientStep?.className).toContain('w-10');
    expect(clientStep?.className).toContain('h-10');
  });

  it('todos os 5 círculos têm o MESMO tamanho (padronização)', () => {
    const { container } = render(
      <QuoteBuilderStepper completedSteps={['client', 'conditions']} activeStep="items" />,
    );
    const circles = container.querySelectorAll('li > button > .rounded-full');
    expect(circles.length).toBe(5);
    circles.forEach((c) => {
      expect(c.className).toContain('h-10');
      expect(c.className).toContain('w-10');
      expect(c.className).not.toContain('ring-4');
    });
  });

  it('última etapa usa last:flex-none para encostar no canto direito', () => {
    const { container } = render(<QuoteBuilderStepper completedSteps={[]} activeStep="client" />);
    const items = container.querySelectorAll('ol > li');
    expect(items.length).toBe(5);
    // Classe utilitária aplicada via Tailwind variant; ela aparece no className
    items.forEach((li) => {
      expect(li.className).toContain('last:flex-none');
      expect(li.className).toContain('flex-1');
    });
  });

  it('shows check icon for completed non-active steps', () => {
    render(<QuoteBuilderStepper completedSteps={['client']} activeStep="conditions" />);

    expect(screen.getByTestId('icon-check')).toBeDefined();
    const clientText = screen.getByText('Cliente');
    const clientIconContainer = clientText.parentElement?.querySelector('.rounded-full');
    expect(clientIconContainer?.className).toContain('bg-primary/20');
  });

  it('renders all 5 labels in the new order', () => {
    render(<QuoteBuilderStepper completedSteps={[]} activeStep="client" />);
    const labels = ['Cliente', 'Condições', 'Itens', 'Personalização', 'Revisão'];
    // T-FIX-5b — decisão Opção A (eslint-disable cirúrgico):
    //
    // 5 labels estáticos do mesmo render(), todos renderizados juntos
    // no DOM. Masking aqui tem alcance mínimo: se 'Cliente' faltar
    // (label hardcoded no componente), os outros 4 provavelmente
    // também faltariam — o usuário veria stepper inteiro quebrado
    // imediatamente.
    //
    // Refactor para it.each exigiria 5 renders separados ou setup
    // helper compartilhado. Custo-benefício não compensa para 5
    // labels estáticos.
    //
    // Severity 'error' continua protegendo todo o repo — esta exceção
    // foi documentada em docs/redeploy/T-FIX-5-LINT-GUARDRAIL.md.
    //
    // Update 2026-05-23: o eslint-disable original tornou-se órfão após
    // refinamento da regra no(s) commit(s) e0f1315/73c2efa — a `no-restricted-syntax`
    // atual só flagga forEach que contém it/test/describe (anti-padrão A),
    // não forEach+expect (anti-padrão B, não ativado). Diretiva removida
    // para zerar o WARN "Unused eslint-disable directive" no gate
    // lint:baseline. Se T-FIX-5b for ativado depois, reintroduzir.
    expect(labels).not.toHaveLength(0);
    for (const label of labels) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('colors connector lines correctly based on activeStep', () => {
    const { container } = render(
      <QuoteBuilderStepper completedSteps={['client', 'conditions']} activeStep="items" />,
    );
    const connectors = container.querySelectorAll('[aria-hidden="true"]');
    // Verificando classes de margem responsiva
    expect(connectors[0].className).toContain('mx-1');
    expect(connectors[0].className).toContain('sm:mx-4');

    const innerLines = container.querySelectorAll('[aria-hidden="true"] > div');
    expect(innerLines[0].className).toContain('bg-primary'); // 0→1
    expect(innerLines[1].className).toContain('bg-primary'); // 1→2
    expect(innerLines[2].className).toContain('bg-border'); // 2→3
    expect(innerLines[3].className).toContain('bg-border'); // 3→4
  });

  // Removido: 'has consistent icon sizes and stroke widths' (forEach vazio
  // no-op — ícones estão mockados neste arquivo, o teste real precisa
  // rodar contra os componentes lucide-react sem mock para verificar
  // h-[18px] w-[18px] + strokeWidth=2. Movido para test list pra ser
  // reintroduzido em suite separada de visual regression.

  it('marks all as muted/border when nothing is active or completed', () => {
    render(<QuoteBuilderStepper completedSteps={[]} />);
    const mutedSteps = document.querySelectorAll('.bg-muted\\/50');
    expect(mutedSteps.length).toBe(5);
  });

  it('calls onStepClick when a step is clicked', () => {
    const onStepClick = vi.fn();
    render(
      <QuoteBuilderStepper completedSteps={[]} activeStep="client" onStepClick={onStepClick} />,
    );

    const conditionsStep = screen.getByText('Condições').closest('button');
    if (conditionsStep) {
      fireEvent.click(conditionsStep);
    }

    expect(onStepClick).toHaveBeenCalledWith('conditions');
  });
});
