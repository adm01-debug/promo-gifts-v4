import { Button } from '@/components/ui/button';
import type { QuoteBuilderStep } from './QuoteBuilderStepper';

interface QuoteBuilderNavigationProps {
  currentStep: QuoteBuilderStep;
  onNext: () => void;
  onPrev: () => void;
  isLastStep: boolean;
}

export function QuoteBuilderNavigation({
  currentStep,
  onNext,
  onPrev,
  isLastStep,
}: QuoteBuilderNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t bg-background px-6 py-3 shadow-lg md:relative md:border-t-0 md:bg-transparent md:px-0 md:shadow-none">
      <Button
        variant="outline"
        onClick={onPrev}
        disabled={currentStep === 'client'}
        data-testid="wizard-prev-button"
      >
        Voltar
      </Button>
      <Button onClick={onNext} data-testid="wizard-next-button">
        {isLastStep ? 'Salvar Orçamento' : 'Próximo'}
      </Button>
    </div>
  );
}
