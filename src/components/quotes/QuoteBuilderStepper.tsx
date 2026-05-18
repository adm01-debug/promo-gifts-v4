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
    <div data-testid="quote-wizard" role="tablist" className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isActive = step.id === activeStep;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200",
                    isCompleted && !isActive &&
                      "bg-primary/20 border-primary text-primary",
                    isActive &&
                      "bg-primary border-primary text-primary-foreground scale-110 shadow-md",
                    !isCompleted && !isActive &&
                      "bg-muted/50 border-border text-muted-foreground"
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium transition-colors whitespace-nowrap",
                    isActive && "text-primary",
                    isCompleted && !isActive && "text-foreground",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-3 mt-[-1rem]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      STEPS.findIndex(s => s.id === activeStep) > index ? "bg-primary" : "bg-border"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
