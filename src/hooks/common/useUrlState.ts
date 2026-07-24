/**
 * useUrlState — sincroniza estado com query params da URL para deep-linking e share.
 * Substitui useState quando o estado deve persistir no histórico/URL.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useUrlState<T extends string>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [params, setParams] = useSearchParams();
  const value = (params.get(key) as T) ?? defaultValue;

  const setValue = useCallback(
    (next: T) => {
      const newParams = new URLSearchParams(params);
      if (next === defaultValue) newParams.delete(key);
      else newParams.set(key, next);
      setParams(newParams, { replace: true });
    },
    [key, defaultValue, params, setParams],
  );

  return [value, setValue];
}

export function useUrlBoolean(
  key: string,
  defaultValue = false,
): [boolean, (value: boolean) => void] {
  const [params, setParams] = useSearchParams();
  const value = useMemo(() => {
    const raw = params.get(key);
    if (raw === null) return defaultValue;
    return raw === '1' || raw === 'true';
  }, [params, key, defaultValue]);

  const setValue = useCallback(
    (next: boolean) => {
      const newParams = new URLSearchParams(params);
      if (next === defaultValue) newParams.delete(key);
      else newParams.set(key, next ? '1' : '0');
      setParams(newParams, { replace: true });
    },
    [key, defaultValue, params, setParams],
  );

  return [value, setValue];
}
