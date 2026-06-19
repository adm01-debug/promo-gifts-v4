/**
 * HorizontalStepper — Stepper visual for product form wizard
 */
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import type { ProductFormData } from './ProductFormSchema';

export type StepId =
  | 'essentials'
  | 'commercial'
  | 'packaging'
  | 'fiscal'
  | 'engraving'
  | 'classification'
  | 'media'
  | 'content'
  | 'kits';

export interface StepDef {
  id: StepId;
  label: string;
  description: string;
  icon: React.ElementType;
  requiredFields: Array<keyof ProductFormData>;
  fieldLabels: Record<string, string>;
}

interface HorizontalStepperProps {
  steps: StepDef[];
  activeIndex: number;
  stepReady: boolean[];
  stepErrors: number[];
  onStepClick: (i: number) => void;
  missingFields: string[][];
  showValidation: boolean;
}

export function HorizontalStepper({
  steps,
  activeIndex,
  stepReady,
  stepErrors,
  onStepClick,
  missingFields,
  showValidation,
}: HorizontalStepperProps) {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const completedSteps = stepReady.filter(Boolean).length;
  const progressPercent = (completedSteps / steps.length) * 100;

  return (
    <div className="w-full" role="navigation" aria-label="Etapas do cadastro de produto">
      {/* Desktop Stepper */}
      <div className="hidden md:block">
        <div
          className="relative flex items-start justify-between"
          role="tablist"
          aria-label="Etapas"
        >
          <div className="absolute left-[5%] right-[5%] top-5 h-0.5 bg-muted" />
          <div
            className="absolute left-[5%] top-5 h-0.5 bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent * 0.9}%` }}
          />

          {steps.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === activeIndex;
            const isDone = stepReady[i];
            const hasError = stepErrors[i] > 0;
            const hasMissing = showValidation && missingFields[i].length > 0;

            return (
              <div
                key={step.id}
                className={cn(
                  'relative z-10 flex flex-col items-center',
                  'flex-1 first:flex-initial last:flex-initial',
                  'group/step cursor-pointer',
                )}
                onClick={() => onStepClick(i)}
                onMouseEnter={() => setHoveredStep(i)}
                onMouseLeave={() => setHoveredStep(null)}
                role="tab"
                aria-selected={isActive}
                aria-label={`${step.label}: ${isDone ? 'completo' : hasMissing ? 'campos pendentes' : 'incompleto'}`}
                tabIndex={isActive ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onStepClick(i);
                  }
                  if (e.key === 'ArrowRight' && i < steps.length - 1) {
                    e.preventDefault();
                    onStepClick(i + 1);
                  }
                  if (e.key === 'ArrowLeft' && i > 0) {
                    e.preventDefault();
                    onStepClick(i - 1);
                  }
                }}
              >
                <div
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                    'text-sm font-semibold',
                    isDone &&
                      !isActive &&
                      'border-primary bg-primary/20 text-primary shadow-md shadow-primary/15',
                    isActive &&
                      'scale-110 border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-4 ring-primary/20',
                    !isActive &&
                      !isDone &&
                      'border-muted-foreground/30 bg-muted text-muted-foreground',
                    hasMissing && !isActive && 'border-warning ring-2 ring-warning/20',
                    hasError && !isActive && 'border-destructive ring-2 ring-destructive/20',
                    'transition-transform group-hover/step:scale-110 group-hover/step:shadow-lg',
                  )}
                >
                  {isDone && !isActive ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}

                  {hasError && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                      {stepErrors[i]}
                    </span>
                  )}
                  {hasMissing && !hasError && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[9px] font-bold text-primary-foreground">
                      {missingFields[i].length}
                    </span>
                  )}
                </div>

                <div className="mt-2 max-w-[100px] text-center">
                  <p
                    className={cn(
                      'text-xs font-medium transition-colors',
                      isActive && 'text-primary',
                      isDone && !isActive && 'text-foreground',
                      !isActive && !isDone && 'text-muted-foreground',
                      'group-hover/step:text-primary',
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                    {step.description}
                  </p>
                </div>

                {hoveredStep === i && hasMissing && (
                  <div className="absolute left-1/2 top-full z-50 mt-2 w-max max-w-[220px] -translate-x-1/2 animate-fade-in rounded-lg border border-border bg-popover p-2.5 shadow-lg">
                    <p className="mb-1.5 text-[10px] font-semibold text-warning">
                      Campos obrigatórios:
                    </p>
                    <ul className="space-y-0.5">
                      {missingFields[i].map((label) => (
                        <li
                          key={label}
                          className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                        >
                          <AlertCircle className="h-3 w-3 shrink-0 text-warning" />
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Stepper */}
      <div className="space-y-3 md:hidden">
        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              {React.createElement(steps[activeIndex]?.icon || Info, { className: 'h-4 w-4' })}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{steps[activeIndex]?.label}</p>
              <p className="text-xs text-muted-foreground">{steps[activeIndex]?.description}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Passo {activeIndex + 1} de {steps.length}
          </p>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          {steps.map((step, i) => (
            <div
              key={step.id}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === activeIndex ? 'w-6 bg-primary' : 'w-1.5',
                stepReady[i] && i !== activeIndex && 'bg-primary',
                !stepReady[i] && i !== activeIndex && 'bg-muted',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
