import { useState, useCallback } from 'react';
import { authService } from '@/services/authService';
import { logger } from '@/lib/logger';
import { toErrorMessage } from '@/lib/to-error-message';

export function useAuthMFA() {
  const [currentAAL, setCurrentAAL] = useState<'aal1' | 'aal2' | null>(null);
  const [nextAAL, setNextAAL] = useState<'aal1' | 'aal2' | null>(null);
  const [hasMFA, setHasMFA] = useState(false);

  const fetchAAL = useCallback(async () => {
    try {
      const data = await authService.fetchAAL();
      setCurrentAAL(data.currentAAL);
      setNextAAL(data.nextAAL);
      setHasMFA(data.hasMFA);
    } catch (e) {
      if (import.meta.env.DEV) logger.warn('AAL fetch failed', toErrorMessage(e));
    }
  }, []);

  const clearMFA = useCallback(() => {
    setCurrentAAL(null);
    setNextAAL(null);
    setHasMFA(false);
  }, []);

  return {
    currentAAL,
    nextAAL,
    hasMFA,
    fetchAAL,
    clearMFA,
  };
}
