import { useEffect, useState, useCallback } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, SkipForward, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboardingContext } from '@/contexts/OnboardingContext';
import { useNavigate, useLocation } from 'react-router-dom';
interface TooltipPosition {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}

export function OnboardingTour() {
  const { showTour, currentStep, currentStepData, totalSteps, nextStep, prevStep, skipTour } =
    useOnboardingContext();

  const navigate = useNavigate();
  const location = useLocation();
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({});
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const updatePositions = useCallback(() => {
    if (!currentStepData) return;

    const target = document.querySelector(currentStepData.targetSelector);
    if (target) {
      const rect = target.getBoundingClientRect();
      setHighlightRect(rect);

      const padding = 16;
      const tooltipWidth = 320;
      const tooltipHeight = 200;

      let position: TooltipPosition = {};

      switch (currentStepData.position) {
        case 'right':
          position = {
            top: rect.top + rect.height / 2 - tooltipHeight / 2,
            left: rect.right + padding,
          };
          break;
        case 'left':
          position = {
            top: rect.top + rect.height / 2 - tooltipHeight / 2,
            left: rect.left - tooltipWidth - padding,
          };
          break;
        case 'bottom':
          position = {
            top: rect.bottom + padding,
            left: rect.left + rect.width / 2 - tooltipWidth / 2,
          };
          break;
        case 'top':
          position = {
            top: rect.top - tooltipHeight - padding,
            left: rect.left + rect.width / 2 - tooltipWidth / 2,
          };
          break;
        // no default
      }

      // Ensure tooltip stays within viewport
      if (position.left !== undefined && position.left < padding) {
        position.left = padding;
      }
      if (
        position.left !== undefined &&
        position.left + tooltipWidth > window.innerWidth - padding
      ) {
        position.left = window.innerWidth - tooltipWidth - padding;
      }
      if (position.top !== undefined && position.top < padding) {
        position.top = padding;
      }
      if (
        position.top !== undefined &&
        position.top + tooltipHeight > window.innerHeight - padding
      ) {
        position.top = window.innerHeight - tooltipHeight - padding;
      }

      setTooltipPosition(position);
    } else {
      // Fallback to center if target not found
      setHighlightRect(null);
      setTooltipPosition({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 160,
      });
    }
  }, [currentStepData]);

  // Navigate to correct route for step - com proteção contra loops
  useEffect(() => {
    // Proteção: só navega se o tour estiver ativo E não estiver em loop
    if (!showTour || !currentStepData?.route) return;

    // Normalizar rotas para comparação (remove trailing slash)
    const currentPath = location.pathname.replace(/\/$/, '') || '/';
    const targetPath = currentStepData.route.replace(/\/$/, '') || '/';

    // Verificar se já está na rota correta ou em rota equivalente
    // /mockup e /mockup-generator são consideradas equivalentes
    const isEquivalentRoute =
      currentPath === targetPath ||
      (targetPath === '/mockup' && currentPath === '/mockup-generator') ||
      (targetPath === '/mockup-generator' && currentPath === '/mockup');

    if (!isEquivalentRoute) {
      // Usar replace para não criar histórico infinito
      navigate(currentStepData.route, { replace: true });
    }
  }, [showTour, currentStepData?.route, location.pathname, navigate]);

  // Update positions when step changes or on resize
  useEffect(() => {
    if (!showTour) return;

    // Small delay to allow DOM to update
    const timer = setTimeout(updatePositions, 100);

    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions);
    };
  }, [showTour, currentStep, updatePositions]);

  if (!showTour || !currentStepData) return null;

  return (
    <AnimatePresence>
      <div data-testid="onboarding-tour" className="pointer-events-none fixed inset-0 z-[100]">
        {/* Overlay with spotlight effect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto absolute inset-0"
          style={{
            background: highlightRect
              ? `radial-gradient(ellipse ${highlightRect.width + 40}px ${highlightRect.height + 40}px at ${highlightRect.left + highlightRect.width / 2}px ${highlightRect.top + highlightRect.height / 2}px, transparent 0%, rgba(0, 0, 0, 0.75) 100%)`
              : 'rgba(0, 0, 0, 0.75)',
          }}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Highlight border around target element */}
        {highlightRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="pointer-events-none absolute rounded-lg border-2 border-primary"
            style={{
              top: highlightRect.top - 4,
              left: highlightRect.left - 4,
              width: highlightRect.width + 8,
              height: highlightRect.height + 8,
              boxShadow: '0 0 0 4px rgba(var(--primary), 0.2), 0 0 20px rgba(var(--primary), 0.4)',
            }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-auto absolute w-80"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
          }}
        >
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">
                  Passo {currentStep + 1} de {totalSteps}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={skipTour}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
                {currentStepData.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {currentStepData.description}
              </p>
            </div>

            {/* Progress bar */}
            <div className="px-4 pb-2">
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 px-4 pb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={skipTour}
                className="text-muted-foreground"
              >
                <SkipForward className="mr-1 h-4 w-4" />
                Pular
              </Button>

              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <Button variant="outline" size="sm" onClick={prevStep}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Anterior
                  </Button>
                )}
                <Button size="sm" onClick={nextStep}>
                  {currentStep === totalSteps - 1 ? 'Concluir' : 'Próximo'}
                  {currentStep < totalSteps - 1 && <ChevronRight className="ml-1 h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
