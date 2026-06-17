import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface KeyboardShortcutsProps {
  onGenerate: () => void;
  onReset: () => void;
  onDownload: () => void;
  onStepChange?: (step: number) => void;
  canGenerate: boolean;
  canDownload: boolean;
  isLoading: boolean;
}

export function useKeyboardShortcuts({
  onGenerate,
  onReset,
  onDownload,
  canGenerate,
  canDownload,
  isLoading,
  onStepChange,
}: KeyboardShortcutsProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Number keys 1-6: Navigate steps
      if (e.key >= '1' && e.key <= '6' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const step = parseInt(e.key, 10);
        if (onStepChange) {
          onStepChange(step);
          return;
        }
      }

      // Ctrl/Cmd + Enter: Generate mockup
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canGenerate && !isLoading) {
          onGenerate();
          toast.info('⌨️ Gerando mockup...', { duration: 1500 });
        } else if (!canGenerate) {
          toast.warning('Complete todos os campos antes de gerar');
        }
        return;
      }

      // Ctrl/Cmd + D: Download mockup
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (canDownload) {
          onDownload();
          toast.info('⌨️ Baixando mockup...', { duration: 1500 });
        }
        return;
      }

      // Ctrl/Cmd + R (without shift): Reset form (prevent page refresh)
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
        e.preventDefault();
        onReset();
        toast.info('⌨️ Formulário limpo', { duration: 1500 });
        return;
      }

      // Escape: Reset/cancel
      if (e.key === 'Escape' && !isLoading) {
        e.preventDefault();
        onReset();
        toast.info('⌨️ Formulário limpo', { duration: 1500 });
        return;
      }
    },
    [canGenerate, canDownload, isLoading, onGenerate, onDownload, onReset, onStepChange],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Component that shows keyboard shortcuts hint
export function KeyboardShortcutsHint({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px]">Ctrl</kbd>
          <span>+</span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px]">Enter</kbd>
          <span className="ml-1">Gerar</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px]">Ctrl</kbd>
          <span>+</span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px]">D</kbd>
          <span className="ml-1">Baixar</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px]">1-6</kbd>
          <span className="ml-1">Passos</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px]">Esc</kbd>
          <span className="ml-1">Limpar</span>
        </span>
      </div>
    </div>
  );
}
