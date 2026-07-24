import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Wand2, Palette, Layers, Cpu, Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface GeneratingOverlayProps {
  isVisible: boolean;
  productName?: string;
  techniqueName?: string;
}

const GENERATION_STEPS = [
  { icon: Layers, label: 'Analisando produto', duration: 1500 },
  { icon: Palette, label: 'Aplicando técnica', duration: 2000 },
  { icon: Wand2, label: 'Posicionando logo', duration: 1500 },
  { icon: Cpu, label: 'Gerando com IA', duration: 3000 },
  { icon: Sparkles, label: 'Finalizando', duration: 1000 },
];

export function GeneratingOverlay({
  isVisible,
  productName,
  techniqueName,
}: GeneratingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(0);
      setProgress(0);
      return;
    }

    let totalElapsed = 0;
    const totalDuration = GENERATION_STEPS.reduce((acc, step) => acc + step.duration, 0);

    const interval = setInterval(() => {
      totalElapsed += 100;
      const newProgress = Math.min((totalElapsed / totalDuration) * 100, 95);
      setProgress(newProgress);

      // Calculate current step
      let elapsed = 0;
      for (let i = 0; i < GENERATION_STEPS.length; i++) {
        elapsed += GENERATION_STEPS[i].duration;
        if (totalElapsed < elapsed) {
          setCurrentStep(i);
          break;
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const CurrentIcon = GENERATION_STEPS[currentStep]?.icon || Sparkles;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-background/80 backdrop-blur-md',
        'animate-fade-in',
      )}
      role="alert"
      aria-live="polite"
      aria-busy="true"
      data-testid="generating-overlay"
    >
      <div className="relative mx-4 w-full max-w-md animate-scale-in rounded-2xl border bg-card p-8 shadow-2xl">
        {/* Decorative background elements */}
        <div className="absolute -right-12 -top-12 h-32 w-32 animate-pulse rounded-full bg-primary/20 blur-3xl" />
        <div
          className="absolute -bottom-12 -left-12 h-32 w-32 animate-pulse rounded-full bg-primary/10 blur-3xl"
          style={{ animationDelay: '0.5s' }}
        />

        <div className="relative space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="relative mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <CurrentIcon className="h-10 w-10 animate-bounce text-primary" aria-hidden="true" />
              <div className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-primary/30" />
            </div>
            <h2 className="mb-1 font-display text-xl font-semibold text-foreground">
              Gerando Mockup
            </h2>
            <p className="text-sm text-muted-foreground">
              {productName && techniqueName
                ? `${productName} com ${techniqueName}`
                : 'Processando sua imagem...'}
            </p>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-center text-xs text-muted-foreground">{Math.round(progress)}%</p>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {GENERATION_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isComplete = index < currentStep;
              const isCurrent = index === currentStep;

              return (
                <div
                  key={index}
                  className={cn(
                    'flex items-center gap-3 rounded-lg p-2 transition-all duration-300',
                    isCurrent && 'bg-primary/10',
                    isComplete && 'opacity-60',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300',
                      isComplete && 'bg-success text-success-foreground',
                      isCurrent && 'animate-pulse bg-primary text-primary-foreground',
                      !isComplete && !isCurrent && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isComplete ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <StepIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-sm transition-colors duration-300',
                      isCurrent && 'font-medium text-foreground',
                      !isCurrent && 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                  {isCurrent && (
                    <div className="ml-auto flex gap-1">
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tip */}
          <p className="text-center text-[10px] text-muted-foreground">
            Isso pode levar alguns segundos...
          </p>
        </div>
      </div>
    </div>
  );
}
