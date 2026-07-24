import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  step: number;
  currentStep: number;
  label: string;
  isComplete: boolean;
}

export function StepIndicator({ step, currentStep, label, isComplete }: StepIndicatorProps) {
  const isActive = step === currentStep;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
          isComplete
            ? 'bg-primary text-primary-foreground'
            : isActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
        )}
      >
        {isComplete ? <Check className="h-4 w-4" /> : step}
      </div>
      <span
        className={cn(
          'hidden text-sm font-medium sm:inline',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
      {step < 4 && <ChevronRight className="hidden h-4 w-4 text-muted-foreground sm:inline" />}
    </div>
  );
}
