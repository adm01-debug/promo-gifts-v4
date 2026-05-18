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
      <div className="flex items-start justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isActive = step.id === activeStep;
          const Icon = step.icon;
          const activeIndex = STEPS.findIndex((s) => s.id === activeStep);

          return (
            <div key={step.id} className="flex items-start flex-1 min-w-0">
              {/* Step column — circle + label, fixed widths para harmonia visual */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200",
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
                    "text-xs font-medium transition-colors whitespace-nowrap leading-none",
                    isActive && "text-primary",
                    isCompleted && !isActive && "text-foreground",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line — centralizada verticalmente com o círculo (h-10 → center = 20px) */}
              {index < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-4 mt-[19px]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      activeIndex > index ? "bg-primary" : "bg-border"
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
