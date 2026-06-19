/**
 * useComparisonShortcuts — atalhos globais do comparador.
 * G X → navega /comparar | Shift+X → limpa | 1-4 → foca produto N
 * D → toggle differences | R → toggle radar
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { toast } from 'sonner';

interface Options {
  onToggleDifferences?: () => void;
  onToggleRadar?: () => void;
  enabled?: boolean;
}

export function useComparisonShortcuts(options: Options = {}) {
  const navigate = useNavigate();
  const { clearCompare } = useComparisonStore();
  const lastKeyRef = useRef<{ key: string; at: number } | null>(null);
  const optsRef = useRef(options);

  useEffect(() => {
    optsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (options.enabled === false) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const now = Date.now();

      // G X sequence (within 800ms) → navigate
      if (e.key.toLowerCase() === 'g') {
        lastKeyRef.current = { key: 'g', at: now };
        return;
      }
      if (
        lastKeyRef.current?.key === 'g' &&
        now - lastKeyRef.current.at < 800 &&
        e.key.toLowerCase() === 'x'
      ) {
        e.preventDefault();
        lastKeyRef.current = null;
        navigate('/comparar');
        return;
      }
      lastKeyRef.current = null;

      // Shift+X → clear
      if (e.shiftKey && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        clearCompare();
        toast.success('Comparação limpa');
        return;
      }

      // 1-4 → focus product N
      if (['1', '2', '3', '4'].includes(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const idx = parseInt(e.key, 10) - 1;
        const el = document.querySelector(`[data-compare-product="${idx}"]`);
        if (el instanceof HTMLElement) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
        return;
      }

      // D → toggle differences
      if (e.key.toLowerCase() === 'd' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (optsRef.current.onToggleDifferences) {
          e.preventDefault();
          optsRef.current.onToggleDifferences();
        }
        return;
      }

      // R → toggle radar
      if (e.key.toLowerCase() === 'r' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (optsRef.current.onToggleRadar) {
          e.preventDefault();
          optsRef.current.onToggleRadar();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, clearCompare, options.enabled]);
}
