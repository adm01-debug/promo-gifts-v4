/**
 * useCollectionsGlobalShortcuts — Atalhos globais para o módulo Coleções.
 * - `G C` (sequência <800ms): navega para /colecoes
 * - `Shift+C`: navega para /colecoes
 * Ignora quando o foco está em input/textarea/contentEditable.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useCollectionsGlobalShortcuts() {
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

      if (e.shiftKey && k === 'c') {
        e.preventDefault();
        navigate('/colecoes');
        return;
      }

      if (k === 'g') {
        lastG = Date.now();
        return;
      }
      if (k === 'c' && Date.now() - lastG < 800) {
        e.preventDefault();
        lastG = 0;
        navigate('/colecoes');
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
}
