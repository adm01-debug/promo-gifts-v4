import { forwardRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOnboardingContext } from '@/contexts/OnboardingContext';

export const RestartTourButton = forwardRef<HTMLDivElement, Record<string, never>>(
  (_props, ref) => {
    const { restartTour, hasCompletedTour, isLoading } = useOnboardingContext();

    if (isLoading || !hasCompletedTour) return null;

    return (
      <div ref={ref}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={restartTour}
              className="h-8 gap-1.5 border-border text-xs hover:bg-primary/10 hover:text-primary"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reiniciar Tour
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Rever o tour guiado do sistema</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  },
);
RestartTourButton.displayName = 'RestartTourButton';
