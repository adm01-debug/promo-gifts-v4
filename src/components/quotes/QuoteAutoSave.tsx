/**
 * QuoteAutoSave - Sistema de auto-save para orçamentos
 * Salva rascunhos automaticamente no localStorage com indicador visual
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Cloud, CloudOff, Check, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

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
}

const STORAGE_KEY_PREFIX = 'quote_draft_';
const MAX_VERSIONS = 5;

export function QuoteAutoSave({
  quoteId,
  data,
  onChange,
  debounceMs = 2000,
  className,
}: QuoteAutoSaveProps) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dataRef = useRef(data);
  const initialDataRef = useRef<string | null>(null);

  // Storage key único para este orçamento
  const storageKey = `${STORAGE_KEY_PREFIX}${quoteId || 'new'}`;

  // Salvar estado inicial para comparação
  useEffect(() => {
    initialDataRef.current = JSON.stringify(data);
  }, [storageKey]);

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
      // Obter versões anteriores
      const existingDrafts: QuoteDraft[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(storageKey + '_v')) {
          const draft = JSON.parse(localStorage.getItem(key) || '');
          existingDrafts.push(draft);
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

      // Limpar versões antigas (manter apenas MAX_VERSIONS)
      const sortedDrafts = [...existingDrafts].sort((a, b) => b.version - a.version);
      sortedDrafts.slice(MAX_VERSIONS).forEach((draft) => {
        localStorage.removeItem(`${storageKey}_v${draft.version}`);
      });

      setLastSaved(new Date());
      setStatus('saved');

      // Reset para idle após 2s
      setTimeout(() => {
        setStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Erro ao salvar draft:', error);
      setStatus('error');
    }
  }, [storageKey, quoteId]);

  const _handleDiscard = () => {
    localStorage.removeItem(storageKey);

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(storageKey + '_v')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    initialDataRef.current = JSON.stringify(data);
    setStatus('idle');
  };

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
            : 'Salvo automaticamente';
    }
  };

  return (
    <>
      {/* Indicador de status */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2', className)}>
            <AnimatePresence mode="wait">
              <motion.div
                key={status}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {getStatusIcon()}
              </motion.div>
            </AnimatePresence>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {getStatusText()}
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
      localStorage.setItem(storageKey, JSON.stringify(draft));
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
