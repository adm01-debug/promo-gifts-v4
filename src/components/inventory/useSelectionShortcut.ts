/**
 * useSelectionShortcut — Atalho de teclado "s" para alternar o modo seleção.
 *
 * Regras (paridade catálogo):
 *  - Ignora quando há modifier (Ctrl/Cmd/Alt/Shift) — não conflita com Ctrl+S etc.
 *  - Ignora quando foco está em input/textarea/select/contenteditable.
 *  - Idempotente: chama `onToggle` exatamente uma vez por keypress válido.
 */
import { useEffect } from 'react';

export function useSelectionShortcut(onToggle: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 's' && e.key !== 'S') return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        t?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      onToggle();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onToggle, enabled]);
}
