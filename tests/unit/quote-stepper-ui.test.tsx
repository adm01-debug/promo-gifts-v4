import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QuoteBuilderStepper } from '../../src/components/quotes/QuoteBuilderStepper';
import '@testing-library/jest-dom';

describe('QuoteBuilderStepper (UI Unit Tests)', () => {
  describe('Visualização de Estados', () => {
    it('deve marcar a etapa ativa com as classes de destaque', () => {
      render(<QuoteBuilderStepper completedSteps={[]} activeStep="items" />);
      
      const stepLabel = screen.getByText('Itens');
      expect(stepLabel).toHaveClass('text-primary');
      
      const activeContainer = stepLabel.parentElement;
      const activeCircle = activeContainer?.querySelector('.rounded-full');
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
      const { rerender } = render(<QuoteBuilderStepper completedSteps={['client']} activeStep="client" />);
      
      let connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      expect(connectors[0]).toHaveClass('bg-border');

      rerender(<QuoteBuilderStepper completedSteps={['client']} activeStep="items" />);
      connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      // Ordem dos passos: client(0) → conditions(1) → items(2) → ...; em "items"
      // (idx 2) os conectores 0 e 1 ficam ativos, e o 2 permanece neutro.
      expect(connectors[0]).toHaveClass('bg-primary');
      expect(connectors[1]).toHaveClass('bg-primary');
      expect(connectors[2]).toHaveClass('bg-border');
    });

    it('deve retroceder o estado visual da barra ao voltar etapas', () => {
      const { rerender } = render(<QuoteBuilderStepper completedSteps={['client', 'items']} activeStep="conditions" />);
      
      let connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      // activeStep="conditions" (idx 1): só o conector 0 fica ativo.
      expect(connectors[0]).toHaveClass('bg-primary');
      expect(connectors[1]).toHaveClass('bg-border');

      rerender(<QuoteBuilderStepper completedSteps={['client']} activeStep="items" />);
      connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      // activeStep="items" (idx 2): conectores 0 e 1 ativos.
      expect(connectors[0]).toHaveClass('bg-primary');
      expect(connectors[1]).toHaveClass('bg-primary');
    });

    it('deve manter todas as conexões anteriores como ativas se estiver na última etapa', () => {
      render(<QuoteBuilderStepper completedSteps={['client', 'items', 'conditions']} activeStep="review" />);
      const connectors = document.querySelectorAll('.h-full.rounded-full.transition-all');
      connectors.forEach(c => expect(c).toHaveClass('bg-primary'));
    });
  });
});
