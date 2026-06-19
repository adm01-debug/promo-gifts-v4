/**
 * useAutoRevocations
 *
 * Lê `mcp_key_auto_revocations` enriquecido com nome/prefixo da chave e email
 * do emissor para exibir no painel de observabilidade do mecanismo de defesa
 * (revogação automática de chaves FULL quando o emissor perde o papel dev).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AutoRevocationRow {
  id: string;
  key_id: string;
  created_by: string;
  revoked_at: string;
  source: 'trigger' | 'cron' | 'manual';
  reason: string;
  key_name: string | null;
  key_prefix: string | null;
  actor_email: string | null;
}

interface RawRow {
  id: string;
  key_id: string;
  created_by: string;
  revoked_at: string;
  source: AutoRevocationRow['source'];
  reason: string;
  mcp_api_keys: { name: string | null; key_prefix: string | null } | null;
}

export function useAutoRevocations() {
  return useQuery({
    queryKey: ['mcp-key-auto-revocations'],
    queryFn: async (): Promise<AutoRevocationRow[]> => {
      const { data, error } = await supabase
        .from('mcp_key_auto_revocations')
        .select(
          'id, key_id, created_by, revoked_at, source, reason, mcp_api_keys(name, key_prefix)',
        )
        .order('revoked_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const rows = (data ?? []) as unknown as RawRow[];

      // Resolve emails dos emissores em batch (best-effort: profiles)
      const userIds = [...new Set(rows.map((r) => r.created_by))];
      const emailMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('user_id', userIds);
        for (const p of (profiles ?? []) as Array<{ user_id: string; email: string | null }>) {
          if (p.email) emailMap.set(p.user_id, p.email);
        }
      }

      return rows.map((r) => ({
        id: r.id,
        key_id: r.key_id,
        created_by: r.created_by,
        revoked_at: r.revoked_at,
        source: r.source,
        reason: r.reason,
        key_name: r.mcp_api_keys?.name ?? null,
        key_prefix: r.mcp_api_keys?.key_prefix ?? null,
        actor_email: emailMap.get(r.created_by) ?? null,
      }));
    },
    staleTime: 60_000,
  });
}
