import { useEffect, useRef, useCallback } from 'react';
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
        logger.error('Failed to parse/migrate autosave data', e);
      }
    }
  }, [enabled, key]);

  // Efeito de salvamento (Debounced)
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

      localStorage.setItem(key, JSON.stringify(payload));
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
