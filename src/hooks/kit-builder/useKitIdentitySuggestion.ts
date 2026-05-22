/**
 * useKitIdentitySuggestion — invoca a edge function `kit-identity-suggest`
 * para gerar tag/cor/ícone a partir do nome + itens do kit.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

export interface IdentitySuggestion {
  tag: string;
  color: string;
  icon: string;
  rationale?: string;
}

interface Input {
  name: string;
  items: Array<{ name?: string; sku?: string }>;
  description?: string | null;
}

export function useKitIdentitySuggestion() {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<IdentitySuggestion | null>(null);

  const suggest = useCallback(async (input: Input): Promise<IdentitySuggestion | null> => {
    if (!input.name && input.items.length === 0) return null;
    setIsLoading(true);
    setSuggestion(null);
    try {
      const { data, error } = await supabase.functions.invoke('kit-identity-suggest', {
        body: input,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const s = data?.suggestion as IdentitySuggestion | undefined;
      if (!s?.tag || !s?.color || !s?.icon) throw new Error('Sugestão incompleta');
      setSuggestion(s);
      return s;
    } catch (e) {
      toast.error('Falha ao sugerir identidade', { description: sanitizeError(e) });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { suggest, suggestion, isLoading, clear: () => setSuggestion(null) };
}
