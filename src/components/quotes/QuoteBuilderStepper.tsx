/**
 * QuoteBuilderStepper — Indicador visual de progresso para o fluxo de orçamento
 * 5 etapas: Cliente → Condições → Itens → Personalização → Revisão
 */

import { Check, Building2, CreditCard, Package, Sparkles, FileCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export type QuoteBuilderStep = 'client' | 'conditions' | 'items' | 'personalization' | 'review';

interface StepDef {
  id: QuoteBuilderStep;
  label: string;
  icon: typeof Building2;
}

const STEPS: StepDef[] = [
  { id: 'client', label: 'Cliente', icon: Building2 },
  { id: 'conditions', label: 'Condições', icon: CreditCard },
  { id: 'items', label: 'Itens', icon: Package },
  { id: 'personalization', label: 'Personalização', icon: Sparkles },
  { id: 'review', label: 'Revisão', icon: FileCheck },
];

interface QuoteBuilderStepperProps {
  /** Which fields have been filled — drives completed state */
  completedSteps: QuoteBuilderStep[];
  /** Optional: highlight a specific step */
  activeStep?: QuoteBuilderStep;
  /** Navigation callback */
  onStepClick?: (step: QuoteBuilderStep) => void;
  className?: string;
}

export function QuoteBuilderStepper({
  completedSteps,
  activeStep,
  onStepClick,
  className,
}: QuoteBuilderStepperProps) {
  return (
    <nav
      aria-label="Progresso do orçamento"
      data-testid="quote-wizard"
      className={cn('w-full', className)}
    >
      <ol className="m-0 flex list-none items-start justify-between p-0">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isActive = step.id === activeStep;
          const Icon = step.icon;
          const activeIndex = STEPS.findIndex((s) => s.id === activeStep);

          const stepNumber = index + 1;
          const status = isActive ? 'Atual' : isCompleted ? 'Concluída' : 'Pendente';

          return (
            <li
              key={step.id}
              className="flex min-w-0 flex-1 items-start"
              aria-current={isActive ? 'step' : undefined}
            >
              {/* Step column — circle + label */}
              <button
                type="button"
                onClick={() => onStepClick?.(step.id)}
                className="group flex shrink-0 cursor-pointer flex-col items-center gap-2 focus:outline-none disabled:cursor-not-allowed"
                aria-label={`Etapa ${stepNumber}: ${step.label} (${status})`}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-200',
                    'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isCompleted && !isActive && 'border-primary bg-primary/20 text-primary',
                    isActive &&
                      'border-primary bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20',
                    !isCompleted && !isActive && 'border-border bg-muted/50 text-muted-foreground',
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  ) : (
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  )}
                </div>
                <span
                  className={cn(
                    'whitespace-nowrap text-[10px] font-medium leading-none transition-colors sm:text-xs',
                    'hidden sm:block', // Esconde no mobile por padrão para economizar espaço
                    isActive && 'block font-semibold text-primary', // Sempre mostra o texto da etapa ativa
                    isCompleted && !isActive && 'text-foreground',
                    !isActive && !isCompleted && 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </button>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div className="mx-1 mt-[19px] h-0.5 flex-1 sm:mx-4" aria-hidden="true">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      activeIndex > index ? 'bg-primary' : 'bg-border',
                    )}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
