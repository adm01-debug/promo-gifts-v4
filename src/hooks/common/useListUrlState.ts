/**
 * useListUrlState — SSOT para páginas de lista que sincronizam filtros/ordem/busca
 * com a query string.
 *
 * Contrato:
 *  - `keys` é o mapa `chave → valor default`. Valores default são REMOVIDOS
 *    da URL para não poluir deep-links (`?status=all` fora, `?status=draft` dentro).
 *  - `searchKey` (opcional) marca a chave textual que precisa de debounce.
 *    Para essa chave: `searchInput` reflete a digitação imediata; `values[searchKey]`
 *    é o valor debounced que já foi para a URL.
 *  - `setValue(key, value)` grava direto (replaceState).
 *  - `setSearchInput(value)` atualiza só o input local; o debounce escreve na URL.
 *  - `clearAll()` volta tudo pro default → URL sem params.
 *
 * Consumidores: /orcamentos (useQuotesListPage) e /carrinhos (CartsListPage).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from '@/hooks/common/useDebounce';

export interface UseListUrlStateConfig<K extends string> {
  keys: Record<K, string>;
  searchKey?: NoInfer<K>;
  debounceMs?: number;
}

export interface UseListUrlStateReturn<K extends string> {
  values: Record<K, string>;
  setValue: (key: K, value: string) => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  clearAll: () => void;
}

export function useListUrlState<K extends string>(
  config: UseListUrlStateConfig<K>,
): UseListUrlStateReturn<K> {
  const { keys, searchKey, debounceMs = 250 } = config;
  const [searchParams, setSearchParams] = useSearchParams();

  // Snapshot estável das chaves — evita loops quando o consumidor passa objeto inline.
  const keyList = useMemo(() => Object.keys(keys) as K[], [keys]);

  // Estado local do input textual (digitação fluida antes do debounce).
  const initialSearch = searchKey ? searchParams.get(searchKey) ?? keys[searchKey] : '';
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const debouncedSearch = useDebounce(searchInput, debounceMs);

  const updateParam = useCallback(
    (key: string, value: string, defaultValue: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!value || value === defaultValue) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setValue = useCallback(
    (key: K, value: string) => {
      updateParam(key, value, keys[key]);
      if (key === searchKey) setSearchInput(value);
    },
    [updateParam, keys, searchKey],
  );

  // Sincroniza busca debounced → URL.
  useEffect(() => {
    if (!searchKey) return;
    updateParam(searchKey, debouncedSearch, keys[searchKey]);
  }, [debouncedSearch, searchKey, keys, updateParam]);

  const clearAll = useCallback(() => {
    if (searchKey) setSearchInput(keys[searchKey]);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const k of keyList) next.delete(k);
        return next;
      },
      { replace: true },
    );
  }, [keyList, keys, searchKey, setSearchParams]);

  const values = useMemo(() => {
    const out = {} as Record<K, string>;
    for (const k of keyList) {
      out[k] = searchParams.get(k) ?? keys[k];
    }
    return out;
  }, [keyList, keys, searchParams]);

  return { values, setValue, searchInput, setSearchInput, clearAll };
}
