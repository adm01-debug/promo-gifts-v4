import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QuoteBuilderStepper, QuoteBuilderStep } from '../../src/components/quotes/QuoteBuilderStepper';
import '@testing-library/jest-dom';

describe('QuoteBuilderStepper (UI Unit Tests)', () => {
  // QA: A ordem dos steps na produção foi atualizada para
  // client → conditions → items → personalization → review (5 etapas).
  // Antes o teste assumia 4 etapas (client → items → conditions → review),
  // o que invalidava os índices usados nas assertions de conectores.
  const steps: QuoteBuilderStep[] = ['client', 'conditions', 'items', 'personalization', 'review'];

  describe('Visualização de Estados', () => {
    it('deve marcar a etapa ativa com as classes de destaque', () => {
      render(<QuoteBuilderStepper completedSteps={[]} activeStep="items" />);

      const stepLabel = screen.getByText('Itens');
      expect(stepLabel).toHaveClass('text-primary');

      const activeContainer = stepLabel.parentElement;
      const activeCircle = activeContainer?.querySelector('.rounded-full');
      // QA: as classes de destaque do ativo são bg-primary + ring-4 +
      // ring-primary/20 + shadow-md (scale-110 foi removido no redesign).
      expect(activeCircle).toHaveClass('bg-primary');
      expect(activeCircle).toHaveClass('ring-4');
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
    it('deve atualizar o progresso da barra de conexão corretamente ao avançar', () => {
      // QA: nova ordem é client(0) → conditions(1) → items(2) → personalization(3) → review(4)
      const { rerender } = render(<QuoteBuilderStepper completedSteps={[]} activeStep="client" />);

      let connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      // activeIndex=0 → todos conectores ficam bg-border
      expect(connectors[0]).toHaveClass('bg-border');

      rerender(<QuoteBuilderStepper completedSteps={['client']} activeStep="items" />);
      connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      // activeIndex=2 → connector[0] (client→conditions) e [1] (conditions→items)
      // ficam bg-primary; [2] (items→personalization) e [3] ficam bg-border
      expect(connectors[0]).toHaveClass('bg-primary');
      expect(connectors[1]).toHaveClass('bg-primary');
      expect(connectors[2]).toHaveClass('bg-border');
    });

    it('deve retroceder o estado visual da barra ao voltar etapas', () => {
      const { rerender } = render(
        <QuoteBuilderStepper completedSteps={['client', 'conditions']} activeStep="items" />,
      );

      let connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      // activeIndex=2 → [0], [1] primary; [2], [3] border
      expect(connectors[0]).toHaveClass('bg-primary');
      expect(connectors[1]).toHaveClass('bg-primary');

      rerender(<QuoteBuilderStepper completedSteps={['client']} activeStep="conditions" />);
      connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      // activeIndex=1 → [0] primary; [1], [2], [3] border
      expect(connectors[0]).toHaveClass('bg-primary');
      expect(connectors[1]).toHaveClass('bg-border');
    });

    it('deve manter todas as conexões anteriores como ativas se estiver na última etapa', () => {
      render(<QuoteBuilderStepper completedSteps={['client', 'items', 'conditions']} activeStep="review" />);
      const connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      connectors.forEach(c => expect(c).toHaveClass('bg-primary'));
    });
  });
});
