/**
 * Kit Wizard Keyboard Shortcuts
 * - ArrowLeft/ArrowRight: prev/next step
 * - 1..4: jump to specific step
 * Disabled when focus is in inputs/textareas/contentEditable.
 */
import { useEffect } from 'react';
import type { KitBuilderStep } from '@/lib/kit-builder';

const STEP_BY_INDEX: KitBuilderStep[] = ['box', 'items', 'personalization', 'summary'];

interface Options {
  enabled?: boolean;
  canProceed: boolean;
  currentStep: KitBuilderStep;
  completedSteps: KitBuilderStep[];
  onPrev: () => void;
  onNext: () => void;
  onJump: (step: KitBuilderStep) => void;
}

export function useKitWizardShortcuts({
  enabled = true,
  canProceed,
  currentStep,
  completedSteps,
  onPrev,
  onNext,
  onJump,
}: Options) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      const isField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || target.isContentEditable;
      if (isField) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'ArrowLeft') {
        if (currentStep === 'box') return;
        e.preventDefault();
        onPrev();
        return;
      }
      if (e.key === 'ArrowRight') {
        if (currentStep === 'summary' || !canProceed) return;
        e.preventDefault();
        onNext();
        return;
      }
      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = Number(e.key) - 1;
        const step = STEP_BY_INDEX[idx];
        if (!step) return;
        // Allow only if completed or current
        if (step === currentStep || completedSteps.includes(step)) {
          e.preventDefault();
          onJump(step);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled, canProceed, currentStep, completedSteps, onPrev, onNext, onJump]);
}
