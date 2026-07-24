import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * useDebounce - Hook para debounce de valores
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useDebouncedCallback - Hook para debounce de callbacks
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay = 300,
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * useThrottle - Hook para throttle de valores (leading-edge com trailing update).
 *
 * BUG-09 FIX: implementacao correta de throttle.
 *
 * PROBLEMA ORIGINAL: o cleanup do useEffect (return () => clearTimeout(handler))
 * cancelava o timer a cada mudanca de `value`, tornando o comportamento identico
 * ao debounce: nenhuma emissao ocorria ate o usuario parar de digitar.
 *
 * SOLUCAO: leading-edge imediato + trailing update via refs.
 *   - Primeira mudanca -> emitida imediatamente (leading edge).
 *   - Durante o lock (limit ms) -> valor mais recente salvo em lastValueRef.
 *   - Apos o lock -> emite lastValueRef.current (trailing edge, se houve mudanca).
 *   - O timer de unlock NAO tem clearTimeout no cleanup do effect -- caso contrario
 *     voltariamos ao comportamento de debounce.
 */
export function useThrottle<T>(value: T, limit = 300): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const inThrottleRef = useRef(false);
  const lastValueRef = useRef(value);
  const limitRef = useRef(limit);

  // Manter limitRef atualizado sem re-rodar o effect de throttle
  useEffect(() => {
    limitRef.current = limit;
  }, [limit]);

  useEffect(() => {
    // Sempre mantem o ref com o valor mais recente
    lastValueRef.current = value;

    if (inThrottleRef.current) {
      // Dentro do periodo de lock: apenas bufferiza o valor mais recente.
      // O trailing timer ira emiti-lo ao final.
      return;
    }

    // Leading edge: emite imediatamente
    setThrottledValue(value);
    inThrottleRef.current = true;

    // Trailing update: ao final do lock, emite o ultimo valor recebido.
    // NOTA CRITICA: este setTimeout NAO deve ser cancelado no cleanup do effect.
    // Se cancelassemos, o throttle se tornaria debounce (identico ao bug original).
    setTimeout(() => {
      inThrottleRef.current = false;
      // Emite o ultimo valor caso tenha mudado durante o periodo de lock
      setThrottledValue(lastValueRef.current);
    }, limitRef.current);

    // Sem return de cleanup aqui -- intencional. O timer de desbloqueio
    // deve sempre completar para liberar o lock e emitir o trailing value.
  }, [value]); // limit excluido intencionalmente -- lido via limitRef

  return throttledValue;
}

/**
 * useSearchAsYouType - Hook para search-as-you-type (CO-06)
 */
export function useSearchAsYouType(
  onSearch: (query: string) => void,
  options: {
    debounceMs?: number;
    minLength?: number;
  } = {},
) {
  const { debounceMs = 300, minLength = 2 } = options;
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debouncedQuery = useDebounce(query, debounceMs);

  /**
   * BUG-24 FIX: estabilizar onSearch via ref para remover das deps do useEffect.
   *
   * PROBLEMA ORIGINAL: onSearch estava nas deps de useEffect (linha ~136).
   * Callers que passam callback inline recebem nova referência a cada render,
   * recriando o useEffect e disparando buscas ou atualizações de isSearching
   * em ciclos desnecessários.
   *
   * SOLUÇÃO: capturar onSearch em ref atualizado a cada render. O useEffect
   * lê via ref, sem precisar do callback nas deps.
   */
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    if (debouncedQuery.length >= minLength) {
      setIsSearching(true);
      onSearchRef.current(debouncedQuery); // BUG-24 FIX: via ref, não closure
      setIsSearching(false);
    } else if (debouncedQuery.length === 0) {
      onSearchRef.current(''); // BUG-24 FIX: via ref
    }
  }, [debouncedQuery, minLength]); // BUG-24 FIX: onSearch removido das deps

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (value.length >= minLength) {
        setIsSearching(true);
      }
    },
    [minLength],
  );

  const clear = useCallback(() => {
    setQuery('');
    onSearchRef.current(''); // BUG-24 FIX: usa ref para consistência
  }, []); // onSearch removido das deps de clear também

  return {
    query,
    setQuery: handleChange,
    clear,
    isSearching: isSearching && query.length >= minLength,
    debouncedQuery,
  };
}

export default useDebounce;
