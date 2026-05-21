import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { QuoteBuilderStepper, QuoteBuilderStep } from '../../src/components/quotes/QuoteBuilderStepper';
import '@testing-library/jest-dom';

describe('QuoteBuilderStepper (UI Unit Tests)', () => {
  afterEach(() => cleanup());
  const steps: QuoteBuilderStep[] = ['client', 'items', 'conditions', 'review'];

  describe('Visualização de Estados', () => {
    it('deve marcar a etapa ativa com as classes de destaque', () => {
      render(<QuoteBuilderStepper completedSteps={[]} activeStep="items" />);
      
      const stepLabel = screen.getByText('Itens');
      expect(stepLabel).toHaveClass('text-primary');
      
      const activeContainer = stepLabel.parentElement;
      const activeCircle = activeContainer?.querySelector('.rounded-full');
      expect(activeCircle).toHaveClass('bg-primary');
      // Estilo da etapa ativa mudou de scale-110 para anel (ring-4 ring-primary/20).
      expect(activeCircle).toHaveClass('ring-4');
      expect(activeCircle).toHaveClass('ring-primary/20');
    });

    it('deve mostrar o ícone de Check em etapas completadas que não são a ativa', () => {
      render(<QuoteBuilderStepper completedSteps={['client']} activeStep="items" />);
      
      const firstStepContainer = screen.getByText('Cliente').parentElement;
      const checkIcon = firstStepContainer?.querySelector('svg');
      expect(checkIcon).toBeDefined();
      // Em etapas completas não ativas, o círculo deve ser bg-primary/20
      const circle = firstStepContainer?.querySelector('.rounded-full');
      expect(circle).toHaveClass('bg-primary/20');
    });

    it('deve mostrar estilo muted para etapas não iniciadas', () => {
      render(<QuoteBuilderStepper completedSteps={[]} activeStep="client" />);
      
      const futureStepLabel = screen.getByText('Revisão');
      expect(futureStepLabel).toHaveClass('text-muted-foreground');
      
      const futureCircle = futureStepLabel.parentElement?.querySelector('.rounded-full');
      expect(futureCircle).toHaveClass('bg-muted/50');
    });
  });
  describe('Transições e Barra de Conexão', () => {
    // Fluxo real (STEPS internos): client(0) → conditions(1) → items(2) → personalization(3) → review(4).
    // São 4 conectores; o conector i fica bg-primary quando activeIndex > i, senão bg-border.
    it('deve atualizar o progresso da barra de conexão corretamente ao avançar', () => {
      const { rerender, container } = render(<QuoteBuilderStepper completedSteps={['client']} activeStep="client" />);

      let connectors = container.querySelectorAll('.h-full.rounded-full.transition-all');
      expect(connectors[0]).toHaveClass('bg-border');

      rerender(<QuoteBuilderStepper completedSteps={['client']} activeStep="conditions" />);
      connectors = container.querySelectorAll('.h-full.rounded-full.transition-all');
      expect(connectors[0]).toHaveClass('bg-primary'); // activeIndex 1 > 0
      expect(connectors[1]).toHaveClass('bg-border');  // 1 > 1 = false
    });

    it('deve retroceder o estado visual da barra ao voltar etapas', () => {
      const { rerender, container } = render(<QuoteBuilderStepper completedSteps={['client', 'conditions']} activeStep="items" />);

      let connectors = container.querySelectorAll('.h-full.rounded-full.transition-all');
      expect(connectors[0]).toHaveClass('bg-primary'); // activeIndex 2 > 0
      expect(connectors[1]).toHaveClass('bg-primary'); // 2 > 1

      rerender(<QuoteBuilderStepper completedSteps={['client']} activeStep="conditions" />);
      connectors = container.querySelectorAll('.h-full.rounded-full.transition-all');
      expect(connectors[0]).toHaveClass('bg-primary'); // 1 > 0
      expect(connectors[1]).toHaveClass('bg-border');  // 1 > 1 = false
    });

    it('deve manter todas as conexões anteriores como ativas se estiver na última etapa', () => {
      const { container } = render(<QuoteBuilderStepper completedSteps={['client', 'conditions', 'items', 'personalization']} activeStep="review" />);
      const connectors = container.querySelectorAll('.h-full.rounded-full.transition-all');
      // activeIndex 4 (review) > todos os índices de conector (0..3) → todos bg-primary
      connectors.forEach(c => expect(c).toHaveClass('bg-primary'));
    });
  });
});
