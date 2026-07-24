/**
 * useFavoriteTemplate — persiste "template favorito" do usuário em localStorage.
 *
 * SSR-safe (checa `typeof window`). Corrompimento no storage retorna null.
 * Só aceita ids que passem pelo validador do consumidor — este hook não conhece
 * o registry (evita ciclos), apenas armazena o valor bruto.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'magazine:favorite-template';

function readStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (typeof v !== 'string' || v.length === 0 || v.length > 100) return null;
    return v;
  } catch {
    return null;
  }
}

function writeStorage(value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // storage indisponível (Safari privado, cota estourada) → ignora silenciosamente
  }
}

export function useFavoriteTemplate() {
  const [favoriteId, setFavoriteId] = useState<string | null>(() => readStorage());

  // Sincroniza entre abas/janelas
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setFavoriteId(readStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteId((current) => {
      const next = current === id ? null : id;
      writeStorage(next);
      return next;
    });
  }, []);

  const clearFavorite = useCallback(() => {
    writeStorage(null);
    setFavoriteId(null);
  }, []);

  return { favoriteId, toggleFavorite, clearFavorite };
}
