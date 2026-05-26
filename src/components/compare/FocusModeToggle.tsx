/**
 * FocusModeToggle (C6 #5) — Tecla F alterna modo Foco (oculta header/sidebar).
 * Adiciona classe `compare-focus-mode` ao <body> para CSS-driven hide.
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';

export function useFocusMode() {
  const [focus, setFocus] = useState(false);

  const toggle = useCallback(() => {
    setFocus((prev) => {
      const next = !prev;
      if (next) {
        document.body.classList.add('compare-focus-mode');
        toast.success('Modo Foco ativado · pressione F para sair');
      } else {
        document.body.classList.remove('compare-focus-mode');
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.classList.remove('compare-focus-mode');
    };
  }, [toggle]);

  return { focus, toggle };
}

export function FocusModeToggle() {
  const { focus, toggle } = useFocusMode();
  return (
    <Button variant="outline" size="sm" onClick={toggle} aria-label="Alternar modo foco (F)">
      {focus ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
      {focus ? 'Sair do Foco' : 'Foco'}
    </Button>
  );
}
