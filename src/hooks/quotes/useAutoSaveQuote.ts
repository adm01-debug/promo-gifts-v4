import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

// Versao atual do schema do payload de AutoSave
const AUTOSAVE_SCHEMA_VERSION = 2;

interface AutoSavePayload<T> {
  version: number;
  data: T;
  savedAt: string;
}

interface AutoSaveOptions<T> {
  enabled: boolean;
  data: T;
  onRestore?: (data: T) => void;
  debounceMs?: number;
  key?: string;
}

/**
 * Migra dados de versoes antigas para a versao atual.
 */
export function migratePayload<T>(
  payload: unknown,
  currentVersion: number = AUTOSAVE_SCHEMA_VERSION,
): AutoSavePayload<T> | null {
  if (!payload || typeof payload !== 'object') return null;

  const versioned = payload as { version?: number };

  if (!versioned.version) {
    logger.debug('[AutoSave] Migrating from v1 to v2');
    return {
      version: currentVersion,
      data: payload as T,
      savedAt: new Date().toISOString(),
    };
  }

  if (versioned.version > currentVersion) {
    logger.warn(
      '[AutoSave] Future payload version detected, skipping restore to prevent state corruption',
    );
    return null;
  }

  return payload as AutoSavePayload<T>;
}

const STALE_DRAFT_DAYS = 7;

/**
 * FIX-E03/E11: Remove stale quote_draft_* and quote_builder_autosave entries from
 * localStorage to free space. Called before retrying after a QuotaExceededError
 * and also runs once on hook mount to prevent accumulation of old 'new' quote drafts.
 */
export function cleanOldQuoteDrafts(olderThanDays = STALE_DRAFT_DAYS): number {
  const cutoff = Date.now() - olderThanDays * 86_400_000;
  let removed = 0;
  const keys = Object.keys(localStorage);
  for (const k of keys) {
    if (!k.startsWith('quote_draft_') && k !== 'quote_builder_autosave') continue;
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { savedAt?: string };
      const savedAt = parsed.savedAt ? new Date(parsed.savedAt).getTime() : 0;
      if (savedAt < cutoff) {
        localStorage.removeItem(k);
        removed++;
      }
    } catch {
      localStorage.removeItem(k);
      removed++;
    }
  }
  return removed;
}

/**
 * Hook para persistencia automatica de rascunhos no LocalStorage com versionamento.
 */
export function useAutoSaveQuote<T>({
  enabled,
  data,
  onRestore,
  debounceMs = 2000,
  key = 'quote_builder_autosave',
}: AutoSaveOptions<T>) {
  const lastSavedRef = useRef<string>('');
  const hasRestoredRef = useRef(false);

  /**
   * BUG-07 FIX: capturar onRestore em ref para estabilizar as deps do useEffect.
   */
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  // Efeito de carregamento inicial (Restaurar)
  useEffect(() => {
    if (!enabled || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const payload = JSON.parse(saved);
        const migrated = migratePayload<T>(payload);

        if (migrated && migrated.data && onRestoreRef.current) {
          onRestoreRef.current(migrated.data);
          lastSavedRef.current = JSON.stringify(migrated.data);
        }
      } catch (e) {
        // BUG-AUTOSAVE-CORRUPT FIX: previously silent — user had no idea the draft
        // was lost. Now we notify and purge the corrupted entry so it isn't retried.
        logger.error('Failed to parse/migrate autosave data', e);
        try { localStorage.removeItem(key); } catch { /* ignore */ }
        toast.warning('Rascunho anterior não pôde ser restaurado (dados corrompidos).', {
          description: 'O formulário foi iniciado em branco. Salve o orçamento assim que possível.',
          duration: 6000,
        });
      }
    }
  }, [enabled, key]);

  // FIX-E11: Clean up stale drafts once per hook instance to prevent accumulation.
  useEffect(() => {
    if (!enabled) return;
    const removed = cleanOldQuoteDrafts();
    if (removed > 0) logger.debug(`[AutoSave] Cleaned ${removed} stale draft(s) from localStorage`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once per mount

  // Efeito de salvamento (Debounced)
  // NOTE: `data` MUST stay in deps. Each `data` change cancels the pending timer
  // and starts a fresh one — that is the intended debounce behaviour.
  // Moving `data` to a ref (like onRestoreRef above) would break debouncing:
  // the timer would no longer reset on rapid changes, and could fire with stale state.
  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(() => {
      const stringData = JSON.stringify(data);

      if (stringData === lastSavedRef.current) return;

      const payload: AutoSavePayload<T> = {
        version: AUTOSAVE_SCHEMA_VERSION,
        data,
        savedAt: new Date().toISOString(),
      };

      const serialized = JSON.stringify(payload);

      // FIX-E03: Handle QuotaExceededError — clean stale drafts then retry once.
      try {
        localStorage.setItem(key, serialized);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'QuotaExceededError') {
          const removed = cleanOldQuoteDrafts(0); // remove ALL stale, regardless of age
          logger.warn(`[AutoSave] Quota exceeded — cleaned ${removed} draft(s), retrying`);
          try {
            localStorage.setItem(key, serialized);
          } catch (retryErr) {
            logger.error('[AutoSave] Quota exceeded even after cleanup — draft NOT saved', retryErr);
            return;
          }
        } else {
          logger.error('[AutoSave] Unexpected error saving draft', err);
          return;
        }
      }

      lastSavedRef.current = stringData;
      logger.debug(`[AutoSave] Quote saved to localStorage (v${AUTOSAVE_SCHEMA_VERSION})`);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [data, enabled, key, debounceMs]);

  /**
   * BUG-13 FIX: clearAutoSave agora memoizado com useCallback.
   *
   * PROBLEMA ORIGINAL: clearAutoSave era uma funcao inline sem useCallback.
   * Callers que a usavam em deps de useEffect recebiam nova referencia a cada render.
   */
  const clearAutoSave = useCallback(() => {
    localStorage.removeItem(key);
    lastSavedRef.current = '';
  }, [key]);

  return { clearAutoSave };
}
