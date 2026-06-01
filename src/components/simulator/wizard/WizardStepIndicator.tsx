/**
 * WizardStepIndicator - Indicador visual dos 4 passos
 *
 * Produto → Local → Especificações → Comparativo
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Package, MapPin, SlidersHorizontal, BarChart3, Check } from 'lucide-react';
import { WIZARD_STEPS, WIZARD_STEP_CONFIG, type WizardStep } from '@/types/domain/simulator-wizard';
import type { UseSimulatorWizardReturn } from '@/hooks/simulator/useSimulatorWizard';

interface WizardStepIndicatorProps {
  wizard: UseSimulatorWizardReturn;
}

const STEP_ICONS: Record<WizardStep, React.ElementType> = {
  product: Package,
  location: MapPin,
  specs: SlidersHorizontal,
  comparison: BarChart3,
};

export function WizardStepIndicator({ wizard }: WizardStepIndicatorProps) {
  const currentIndex = WIZARD_STEPS.indexOf(wizard.currentStep);

  return (
    <div className="w-full">
      {/* Mobile: Progress bar */}
      <div className="sm:hidden">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary">{currentIndex + 1}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{WIZARD_STEPS.length}</span>
          </div>
          <span className="font-semibold">{WIZARD_STEP_CONFIG[wizard.currentStep].shortLabel}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80"
            initial={{ width: 0 }}
            animate={{ width: `${wizard.stepProgress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <div className="mt-2 flex justify-between px-1">
          {WIZARD_STEPS.map((step, idx) => {
            const Icon = STEP_ICONS[step];
            const config = WIZARD_STEP_CONFIG[step];
            const isActive = idx <= currentIndex;
            return (
              <div key={step} className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full transition-colors',
                    idx === currentIndex
                      ? 'bg-primary text-primary-foreground'
                      : isActive
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground/40',
                  )}
                >
                  {idx < currentIndex ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    idx === currentIndex ? 'text-primary' : 'text-muted-foreground/60',
                  )}
                >
                  {config.shortLabel.slice(0, 5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop: Horizontal steps */}
      <div className="hidden sm:block">
        <div className="w-full">
          <div className="relative mb-8">
            <div className="absolute left-12 right-12 top-6 h-1 rounded-full bg-muted" />
            <motion.div
              className="absolute left-12 top-6 h-1 rounded-full bg-gradient-to-r from-primary via-primary to-primary/60"
              initial={{ width: 0 }}
              animate={{
                width: `calc(${(currentIndex / (WIZARD_STEPS.length - 1)) * 100}% - 6rem)`,
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          <div className="relative -mt-6 flex justify-between">
            {WIZARD_STEPS.map((step, idx) => {
              const config = WIZARD_STEP_CONFIG[step];
              const Icon = STEP_ICONS[step];
              const isCompleted = idx < currentIndex;
              const isCurrent = step === wizard.currentStep;
              const isClickable = wizard.canNavigateToStep(step);

              return (
                <motion.button
                  key={step}
                  onClick={() => isClickable && wizard.setStep(step)}
                  disabled={!isClickable}
                  className={cn(
                    'group flex flex-col items-center gap-3 transition-all',
                    isClickable ? 'cursor-pointer' : 'cursor-not-allowed',
                  )}
                  whileHover={isClickable ? { y: -2 } : undefined}
                  whileTap={isClickable ? { scale: 0.98 } : undefined}
                >
                  <motion.div
                    className={cn(
                      'relative flex h-12 w-12 items-center justify-center rounded-full transition-all',
                      isCurrent &&
                        'bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-primary/20',
                      isCompleted && 'bg-primary/15 text-primary',
                      !isCurrent && !isCompleted && 'bg-muted text-muted-foreground',
                    )}
                    initial={false}
                    animate={isCurrent ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" strokeWidth={3} />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}

                    {isCurrent && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-primary/20"
                        initial={{ scale: 1, opacity: 0.5 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}
                  </motion.div>

                  <div className="text-center">
                    <p
                      className={cn(
                        'mb-0.5 text-xs font-medium uppercase tracking-wider',
                        isCurrent ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      Passo {idx + 1}
                    </p>
                    <p
                      className={cn(
                        'text-sm font-semibold transition-colors',
                        isCurrent ? 'text-foreground' : 'text-muted-foreground',
                        isClickable && !isCurrent && 'group-hover:text-foreground',
                      )}
                    >
                      {config.shortLabel}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
