/**
 * useFavoritesGlobalShortcuts — Atalhos globais para o módulo Favoritos.
 * - `G L` (sequência <800ms): navega para /favoritos
 * - `Shift+F`: navega para /favoritos
 * Ignora quando o foco está em input/textarea/contentEditable.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useFavoritesGlobalShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    let lastG = 0;

    function isTyping(e: KeyboardEvent): boolean {
      const t = e.target as HTMLElement | null;
      if (!t) return false;
      return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
    }

    function onKey(e: KeyboardEvent) {
      if (isTyping(e)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();

      // Shift+F: ir para favoritos
      if (e.shiftKey && k === 'f') {
        e.preventDefault();
        navigate('/favoritos');
        return;
      }

      // Sequência G L
      if (k === 'g') {
        lastG = Date.now();
        return;
      }
      if (k === 'l' && Date.now() - lastG < 800) {
        e.preventDefault();
        lastG = 0;
        navigate('/favoritos');
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
}
