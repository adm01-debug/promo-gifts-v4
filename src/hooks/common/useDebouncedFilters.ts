import { useEffect, useRef, useState } from 'react';

/**
 * useDebouncedFilters — guarda um estado interno "rápido" (UI imediata)
 * e propaga para o consumidor com debounce, evitando refetch em cascata.
 */
export function useDebouncedFilters<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      setDebounced(value);
      return;
    }
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
