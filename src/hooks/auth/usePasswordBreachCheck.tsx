import { useState, useCallback, useRef } from 'react';

import { logger } from '@/lib/logger';
interface BreachCheckResult {
  isBreached: boolean;
  count: number | null;
  isChecking: boolean;
  error: string | null;
}

// SHA-1 hash function using Web Crypto API
async function sha1Hash(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function usePasswordBreachCheck() {
  const [result, setResult] = useState<BreachCheckResult>({
    isBreached: false,
    count: null,
    isChecking: false,
    error: null,
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkPassword = useCallback(async (password: string): Promise<boolean> => {
    if (!password || password.length < 8) {
      setResult({ isBreached: false, count: null, isChecking: false, error: null });
      return false;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setResult((prev) => ({ ...prev, isChecking: true, error: null }));

    try {
      const hash = await sha1Hash(password);
      const prefix = hash.substring(0, 5);
      const suffix = hash.substring(5);

      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: {
          'Add-Padding': 'true',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error('Erro ao verificar senha');
      }

      const text = await response.text();
      const hashes = text.split('\n');

      for (const line of hashes) {
        const [hashSuffix, count] = line.split(':');
        if (hashSuffix.trim() === suffix) {
          const breachCount = parseInt(count.trim(), 10);
          setResult({
            isBreached: true,
            count: breachCount,
            isChecking: false,
            error: null,
          });
          return true;
        }
      }

      setResult({
        isBreached: false,
        count: null,
        isChecking: false,
        error: null,
      });
      return false;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return false;
      }
      logger.error('Erro ao verificar senha vazada:', error);
      setResult({
        isBreached: false,
        count: null,
        isChecking: false,
        error: 'Não foi possível verificar',
      });
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setResult({
      isBreached: false,
      count: null,
      isChecking: false,
      error: null,
    });
  }, []);

  return {
    ...result,
    checkPassword,
    reset,
  };
}
