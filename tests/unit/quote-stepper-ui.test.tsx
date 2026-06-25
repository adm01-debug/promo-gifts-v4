import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QuoteBuilderStepper, QuoteBuilderStep } from '../../src/components/quotes/QuoteBuilderStepper';
import '@testing-library/jest-dom';

describe('QuoteBuilderStepper (UI Unit Tests)', () => {
  // Ordem canônica do fluxo (ver useQuoteBuilderState):
  // client -> conditions -> items -> review.
  const steps: QuoteBuilderStep[] = ['client', 'conditions', 'items', 'review'];

  describe('Visualização de Estados', () => {
    it('deve marcar a etapa ativa com as classes de destaque', () => {
      render(<QuoteBuilderStepper completedSteps={[]} activeStep="items" />);
      
      const stepLabel = screen.getByText('Itens');
      expect(stepLabel).toHaveClass('text-primary');
      
      const activeContainer = stepLabel.parentElement;
      const activeCircle = activeContainer?.querySelector('.rounded-full');
      expect(activeCircle).toHaveClass('bg-primary');
      // O destaque da etapa ativa neste stepper é shadow-md + bg-primary (border-primary).
      // Padronização (ver QuoteBuilderStepper.test.tsx): o ativo NÃO usa ring-4 — ele deixava
      // o círculo maior que os demais. scale-110 pertence ao HorizontalStepper.
      expect(activeCircle).toHaveClass('shadow-md');
      expect(activeCircle?.className).not.toContain('ring-4');
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
      // Ordem: client(0) -> conditions(1) -> items(2) -> review(3).
      // Conector[i] fica bg-primary quando activeIndex > i.
      const { rerender } = render(<QuoteBuilderStepper completedSteps={['client']} activeStep="client" />);

      let connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      // activeIndex(client)=0 → nenhum conector preenchido.
      expect(connectors[0]).toHaveClass('bg-border');

      rerender(<QuoteBuilderStepper completedSteps={['client', 'conditions']} activeStep="items" />);
      connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      // activeIndex(items)=2 → conectores 0 e 1 preenchidos, 2 ainda não.
      expect(connectors[0]).toHaveClass('bg-primary');
      expect(connectors[1]).toHaveClass('bg-primary');
      expect(connectors[2]).toHaveClass('bg-border');
    });

    it('deve retroceder o estado visual da barra ao voltar etapas', () => {
      const { rerender } = render(<QuoteBuilderStepper completedSteps={['client', 'conditions', 'items']} activeStep="review" />);

      let connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      // activeIndex(review)=3 → todos os 3 conectores preenchidos.
      expect(connectors[0]).toHaveClass('bg-primary');
      expect(connectors[1]).toHaveClass('bg-primary');
      expect(connectors[2]).toHaveClass('bg-primary');

      rerender(<QuoteBuilderStepper completedSteps={['client', 'conditions']} activeStep="items" />);
      connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      // activeIndex(items)=2 → conector 2 volta a bg-border.
      expect(connectors[0]).toHaveClass('bg-primary');
      expect(connectors[1]).toHaveClass('bg-primary');
      expect(connectors[2]).toHaveClass('bg-border');
    });

    it('deve manter todas as conexões anteriores como ativas se estiver na última etapa', () => {
      render(<QuoteBuilderStepper completedSteps={['client', 'conditions', 'items']} activeStep="review" />);
      const connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      connectors.forEach(c => expect(c).toHaveClass('bg-primary'));
    });
  });
});
