/**
 * QuoteAutoSave - Sistema de auto-save para orçamentos
 * Salva rascunhos automaticamente no localStorage com indicador visual
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Cloud, CloudOff, Check, Loader2, AlertCircle } from 'lucide-react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { logger } from '@/lib/logger';
type SaveStatus = 'error' | 'idle' | 'offline' | 'saved' | 'saving';

interface QuoteDraft {
  id: string;
  data: unknown;
  savedAt: string;
  version: number;
}

interface QuoteAutoSaveProps {
  quoteId?: string;
  data: unknown;
  onChange?: (hasUnsavedChanges: boolean) => void;
  debounceMs?: number;
  className?: string;
  /** Timestamp (Date.now()) set by the parent after a successful server save.
   *  When it changes, the "unsaved changes" baseline is reset so the indicator
   *  clears without needing to navigate away and back. */
  serverSavedAt?: number;
}

const STORAGE_KEY_PREFIX = 'quote_draft_';
const MAX_VERSIONS = 5;

export function QuoteAutoSave({
  quoteId,
  data,
  onChange,
  debounceMs = 2000,
  className,
  serverSavedAt,
}: QuoteAutoSaveProps) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const dataRef = useRef(data);
  const initialDataRef = useRef<string | null>(null);

  // Storage key único para este orçamento
  const storageKey = `${STORAGE_KEY_PREFIX}${quoteId || 'new'}`;

  // Cleanup timers on unmount
  // BUG-H FIX: clear edit-mode localStorage entries on unmount to prevent orphan accumulation
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      // Only clean up edit-mode drafts (quoteId is a real UUID, not 'new').
      // New-quote drafts are intentionally kept so useAutoSaveQuote can restore them.
      if (quoteId) {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k === storageKey || k.startsWith(`${storageKey}_v`))) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        } catch { /* ignore storage errors on unmount */ }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId, storageKey]);

  // BUG-J FIX: snapshot initial data AFTER the first real render, not on storageKey change.
  // Previously, the snapshot was taken synchronously when storageKey changed — before
  // useAutoSaveQuote could restore state, so the component immediately showed "Alterações
  // não salvas" even though the data was just restored from localStorage.
  // Using a one-shot ref flag ensures the snapshot is taken on the second render,
  // by which time restored state has propagated into props.
  const initialSnapshottedRef = useRef(false);
  useEffect(() => {
    // Reset snapshot gate whenever storageKey changes (e.g. navigating between quotes)
    initialSnapshottedRef.current = false;
    initialDataRef.current = null;
  }, [storageKey]);

  useEffect(() => {
    if (!initialSnapshottedRef.current) {
      initialSnapshottedRef.current = true;
      initialDataRef.current = JSON.stringify(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  // BUG-SERVER-SAVED-AT FIX: when the parent reports a successful server save,
  // reset the "unsaved changes" baseline to the current snapshot so the badge
  // clears immediately — previously serverSavedAt was passed but never consumed,
  // leaving the "Não salvo" badge visible even after a successful save.
  useEffect(() => {
    if (!serverSavedAt) return;
    initialDataRef.current = JSON.stringify(dataRef.current);
    setHasUnsavedChanges(false);
    onChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSavedAt]);

  // Detectar mudanças
  useEffect(() => {
    dataRef.current = data;

    const currentData = JSON.stringify(data);
    const hasChanges = currentData !== initialDataRef.current;

    setHasUnsavedChanges(hasChanges);
    onChange?.(hasChanges);

    // Debounce auto-save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (hasChanges) {
      setStatus('idle');
      timeoutRef.current = setTimeout(() => {
        saveDraft();
      }, debounceMs);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, debounceMs, onChange]);

  // Verificar conectividade
  useEffect(() => {
    const handleOnline = () => {
      if (status === 'offline') {
        setStatus('idle');
      }
    };

    const handleOffline = () => {
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [status]);

  const saveDraft = useCallback(() => {
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }

    setStatus('saving');

    try {
      // Obter versões anteriores. Uma versão histórica corrompida (storage
      // truncado por quota, adulteração, drift de schema) NÃO deve abortar o
      // autosave inteiro — senão a cotação para de persistir silenciosamente.
      // Snapshot de keys antes de qualquer remoção: removeItem durante iteração
      // por índice desloca os índices e pula items subsequentes.
      const allKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) allKeys.push(k);
      }
      const existingDrafts: QuoteDraft[] = [];
      for (const key of allKeys) {
        if (key.startsWith(`${storageKey}_v`)) {
          try {
            existingDrafts.push(JSON.parse(localStorage.getItem(key) || '') as QuoteDraft);
          } catch {
            localStorage.removeItem(key);
          }
        }
      }

      // Criar nova versão
      const newDraft: QuoteDraft = {
        id: quoteId || 'new',
        data: dataRef.current,
        savedAt: new Date().toISOString(),
        version: Date.now(),
      };

      // Salvar draft atual
      localStorage.setItem(storageKey, JSON.stringify(newDraft));

      // Salvar versão histórica
      const versionKey = `${storageKey}_v${newDraft.version}`;
      localStorage.setItem(versionKey, JSON.stringify(newDraft));

      // Limpar versões antigas (manter apenas MAX_VERSIONS).
      // existingDrafts não inclui o newDraft recém-salvo, então o total após
      // o save é existingDrafts.length + 1. Para manter MAX_VERSIONS no total,
      // devemos manter apenas MAX_VERSIONS - 1 dos existentes.
      const sortedDrafts = [...existingDrafts].sort((a, b) => b.version - a.version);
      sortedDrafts.slice(MAX_VERSIONS - 1).forEach((draft) => {
        localStorage.removeItem(`${storageKey}_v${draft.version}`);
      });

      if (!mountedRef.current) return;
      setLastSaved(new Date());
      setStatus('saved');

      // Reset para idle após 2s
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setStatus('idle');
      }, 2000);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        logger.error('localStorage quota exceeded — draft não pôde ser salvo', error);
      } else {
        logger.error('Erro ao salvar draft:', error);
      }
      setStatus('error');
    }
  }, [storageKey, quoteId]);

  const getStatusIcon = () => {
    switch (status) {
      case 'saving':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'saved':
        return <Check className="h-4 w-4 text-success" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'offline':
        return <CloudOff className="h-4 w-4 text-warning" />;
      default:
        return <Cloud className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'saving':
        return 'Salvando...';
      case 'saved': {
        if (lastSaved) {
          const secsAgo = Math.round((Date.now() - lastSaved.getTime()) / 1000);
          if (secsAgo < 60) return 'Salvo agora';
          const minsAgo = Math.round(secsAgo / 60);
          return `Salvo há ${minsAgo} min`;
        }
        return 'Salvo';
      }
      case 'error':
        return 'Erro ao salvar';
      case 'offline':
        return 'Offline';
      default:
        return hasUnsavedChanges
          ? 'Alterações não salvas'
          : lastSaved
            ? `Salvo às ${format(lastSaved, 'HH:mm', { locale: ptBR })}`
            : '';
    }
  };

  const statusText = getStatusText();
  const showIcon = status !== 'idle' || statusText !== '';

  return (
    <>
      {/* Indicador de status */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2', className)}>
            <AnimatePresence mode="wait">
              {showIcon && (
                <motion.div
                  key={status}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {getStatusIcon()}
                </motion.div>
              )}
            </AnimatePresence>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {statusText}
            </span>
            {hasUnsavedChanges && status !== 'saving' && (
              <Badge variant="outline" className="h-5 text-[10px]">
                Não salvo
              </Badge>
            )}
          </div>
        </TooltipTrigger>

        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p className="font-medium">{getStatusText()}</p>
            {lastSaved && (
              <p className="text-muted-foreground">
                Último salvamento: {format(lastSaved, 'HH:mm:ss', { locale: ptBR })}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </>
  );
}

// Hook para usar o auto-save de forma imperativa
export function useQuoteAutoSave(quoteId?: string) {
  const storageKey = `${STORAGE_KEY_PREFIX}${quoteId || 'new'}`;

  const saveDraft = useCallback(
    (data: unknown) => {
      const draft: QuoteDraft = {
        id: quoteId || 'new',
        data,
        savedAt: new Date().toISOString(),
        version: Date.now(),
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch (err) {
        logger.error('useQuoteAutoSave: failed to persist draft', err);
      }
    },
    [storageKey, quoteId],
  );

  const loadDraft = useCallback((): unknown | null => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const draft: QuoteDraft = JSON.parse(stored);
        return draft.data;
      } catch {
        return null;
      }
    }
    return null;
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return { saveDraft, loadDraft, clearDraft };
}
