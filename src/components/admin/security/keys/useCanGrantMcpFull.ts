/**
 * Verifica se o admin atual está autorizado a conceder escopo MCP "*" (FULL).
 * Usa a função SECURITY DEFINER `can_grant_mcp_full` no banco — a RLS de
 * `mcp_full_grantors` em si não é exposta ao frontend.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useCanGrantMcpFull() {
  const [canGrant, setCanGrant] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) {
        if (!cancelled) {
          setCanGrant(false);
          setLoading(false);
        }
        return;
      }
      const { data, error } = await supabase.rpc('can_grant_mcp_full', { _user_id: uid });
      if (cancelled) return;
      setCanGrant(error ? false : Boolean(data));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { canGrant, loading };
}
