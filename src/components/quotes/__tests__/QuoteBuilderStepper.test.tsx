import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuoteBuilderStepper } from '../QuoteBuilderStepper';
import React from 'react';

// Mocking icons to simplify snapshot/queries
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual<typeof import('lucide-react')>('lucide-react');
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
  it('highlights active step with correct classes', () => {
    render(<QuoteBuilderStepper completedSteps={[]} activeStep="client" />);

    const clientStep = screen.getByText('Cliente').parentElement?.querySelector('.rounded-full');
    expect(clientStep?.className).toContain('bg-primary');
    expect(clientStep?.className).toContain('text-primary-foreground');
    expect(clientStep?.className).toContain('scale-110');
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
    labels.forEach((l) => expect(screen.getByText(l)).toBeDefined());
  });

  it('colors connector lines correctly based on activeStep', () => {
    // active = items (index 2). connectors before index 2 should be primary.
    const { container } = render(
      <QuoteBuilderStepper completedSteps={['client', 'conditions']} activeStep="items" />,
    );
    const connectors = container.querySelectorAll('.flex-1.h-0\\.5 > div');
    expect(connectors[0].className).toContain('bg-primary'); // 0→1
    expect(connectors[1].className).toContain('bg-primary'); // 1→2
    expect(connectors[2].className).toContain('bg-border'); // 2→3
    expect(connectors[3].className).toContain('bg-border'); // 3→4
  });

  it('marks all as muted/border when nothing is active or completed', () => {
    render(<QuoteBuilderStepper completedSteps={[]} />);
    const mutedSteps = document.querySelectorAll('.bg-muted\\/50');
    expect(mutedSteps.length).toBe(5);
  });
});
