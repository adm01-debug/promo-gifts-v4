/**
 * QuoteBuilderStepper — Indicador visual de progresso para o fluxo de orçamento
 * 5 etapas: Cliente → Condições → Itens → Personalização → Revisão
 */

import { Check, Building2, CreditCard, Package, Sparkles, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuoteBuilderStep =
  | "client"
  | "conditions"
  | "items"
  | "personalization"
  | "review";

interface StepDef {
  id: QuoteBuilderStep;
  label: string;
  icon: typeof Building2;
}

const STEPS: StepDef[] = [
  { id: "client", label: "Cliente", icon: Building2 },
  { id: "conditions", label: "Condições", icon: CreditCard },
  { id: "items", label: "Itens", icon: Package },
  { id: "personalization", label: "Personalização", icon: Sparkles },
  { id: "review", label: "Revisão", icon: FileCheck },
];

interface QuoteBuilderStepperProps {
  /** Which fields have been filled — drives completed state */
  completedSteps: QuoteBuilderStep[];
  /** Optional: highlight a specific step */
  activeStep?: QuoteBuilderStep;
  className?: string;
}

export function QuoteBuilderStepper({
  completedSteps,
  activeStep,
  className,
}: QuoteBuilderStepperProps) {
  return (
    <nav 
      aria-label="Progresso do orçamento" 
      data-testid="quote-wizard" 
      className={cn("w-full", className)}
    >
      <ol className="flex items-start justify-between list-none p-0 m-0">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isActive = step.id === activeStep;
          const Icon = step.icon;
          const activeIndex = STEPS.findIndex((s) => s.id === activeStep);
          
          const stepNumber = index + 1;
          const status = isActive ? "Atual" : isCompleted ? "Concluída" : "Pendente";

          return (
            <li 
              key={step.id} 
              className="flex items-start flex-1 min-w-0"
              aria-current={isActive ? "step" : undefined}
            >
              {/* Step column — circle + label */}
              <div 
                className="flex flex-col items-center gap-2 shrink-0 group focus:outline-none"
                tabIndex={0}
                aria-label={`Etapa ${stepNumber}: ${step.label} (${status})`}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none",
                    isCompleted && !isActive &&
                      "bg-primary/20 border-primary text-primary",
                    isActive &&
                      "bg-primary border-primary text-primary-foreground shadow-md ring-4 ring-primary/20",
                    !isCompleted && !isActive &&
                      "bg-muted/50 border-border text-muted-foreground"
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
                    "text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap leading-none",
                    "hidden sm:block", // Esconde no mobile por padrão para economizar espaço
                    isActive && "text-primary font-semibold block", // Sempre mostra o texto da etapa ativa
                    isCompleted && !isActive && "text-foreground",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div 
                  className="flex-1 h-0.5 mx-1 sm:mx-4 mt-[19px]" 
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      activeIndex > index ? "bg-primary" : "bg-border"
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
