/**
 * useMcpKeys — listagem + filtros + lookup de criadores das chaves MCP.
 *
 * Reusa o cliente Supabase autenticado (admin via RLS) e enriquece cada
 * chave com `creator_email` / `creator_name` via lookup batch em `profiles`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isFullAccess } from '@/lib/mcp/scopes';
import { sanitizeError } from '@/lib/security/sanitize-error';
import { useDevChallenge } from '@/contexts/DevChallengeContext';
import { handleStepUpError } from '@/lib/auth/step-up-error';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

export interface McpKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  description: string | null;
  created_by: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  rotated_from: string | null;
  // enriched
  creator_email: string | null;
  creator_name: string | null;
  status: 'active' | 'expired' | 'revoked';
  is_full: boolean;
}

export type StatusFilter = 'active' | 'all' | 'expired' | 'revoked';
export type SortKey = 'created_desc' | 'expires_asc' | 'last_used_desc';

export interface CreatorOption {
  user_id: string;
  email: string | null;
  name: string | null;
  count: number;
}

interface Filters {
  search: string;
  status: StatusFilter;
  onlyFull: boolean;
  sort: SortKey;
  /** UUID de `created_by` ou `null` para todos. */
  creator: string | null;
  /** ISO date (YYYY-MM-DD) — incluído (>=). */
  createdFrom: string | null;
  /** ISO date (YYYY-MM-DD) — incluído (data + 23:59:59 local, <=). */
  createdTo: string | null;
}

function deriveStatus(row: {
  revoked_at: string | null;
  expires_at: string | null;
}): McpKeyRow['status'] {
  if (row.revoked_at) return 'revoked';
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return 'expired';
  return 'active';
}

export function useMcpKeys() {
  const { challenge } = useDevChallenge();
  const [rows, setRows] = useState<McpKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'all',
    onlyFull: false,
    sort: 'created_desc',
    creator: null,
    createdFrom: null,
    createdTo: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: keys, error } = await supabase
      .from('mcp_api_keys')
      .select(
        'id, name, key_prefix, scopes, description, created_by, last_used_at, expires_at, revoked_at, created_at, rotated_from',
      )
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar chaves', {
        description: 'Não foi possível carregar as chaves.',
      });
      setRows([]);
      setLoading(false);
      return;
    }

    const ids = [...new Set((keys ?? []).map((k) => k.created_by).filter(Boolean))];
    let creators = new Map<string, { email: string | null; name: string | null }>();
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', ids);
      creators = new Map(
        (profiles ?? [])
          .filter(
            (p): p is { user_id: string; email: string | null; full_name: string | null } =>
              p.user_id !== null,
          )
          .map((p) => [p.user_id, { email: p.email, name: p.full_name }]),
      );
    }

    const enriched: McpKeyRow[] = (keys ?? []).map((k) => {
      const c = creators.get(k.created_by);
      return {
        ...k,
        scopes: k.scopes ?? [],
        creator_email: c?.email ?? null,
        creator_name: c?.name ?? null,
        status: deriveStatus(k),
        is_full: isFullAccess(k.scopes ?? []),
      };
    });

    setRows(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let out = rows;
    const q = filters.search.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.key_prefix.toLowerCase().includes(q) ||
          (r.creator_email ?? '').toLowerCase().includes(q),
      );
    }
    if (filters.status !== 'all') {
      out = out.filter((r) => r.status === filters.status);
    }
    if (filters.onlyFull) {
      out = out.filter((r) => r.is_full);
    }
    if (filters.creator) {
      out = out.filter((r) => r.created_by === filters.creator);
    }
    if (filters.createdFrom) {
      // Inclui o dia inteiro: >= 00:00:00 local
      const from = new Date(`${filters.createdFrom}T00:00:00`).getTime();
      if (!Number.isNaN(from)) {
        out = out.filter((r) => new Date(r.created_at).getTime() >= from);
      }
    }
    if (filters.createdTo) {
      // Inclui o dia inteiro: <= 23:59:59.999 local
      const to = new Date(`${filters.createdTo}T23:59:59.999`).getTime();
      if (!Number.isNaN(to)) {
        out = out.filter((r) => new Date(r.created_at).getTime() <= to);
      }
    }
    const sorted = [...out];
    switch (filters.sort) {
      case 'expires_asc':
        sorted.sort((a, b) => {
          const ax = a.expires_at ? new Date(a.expires_at).getTime() : Number.POSITIVE_INFINITY;
          const bx = b.expires_at ? new Date(b.expires_at).getTime() : Number.POSITIVE_INFINITY;
          return ax - bx;
        });
        break;
      case 'last_used_desc':
        sorted.sort((a, b) => {
          const ax = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
          const bx = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
          return bx - ax;
        });
        break;
      default:
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return sorted;
  }, [rows, filters]);

  /** Lista única de criadores presentes nas chaves (para popular o filtro). */
  const creators = useMemo<CreatorOption[]>(() => {
    const map = new Map<string, CreatorOption>();
    for (const r of rows) {
      if (!r.created_by) continue;
      const cur = map.get(r.created_by);
      if (cur) {
        cur.count += 1;
      } else {
        map.set(r.created_by, {
          user_id: r.created_by,
          email: r.creator_email,
          name: r.creator_name,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const an = (a.name ?? a.email ?? a.user_id).toLowerCase();
      const bn = (b.name ?? b.email ?? b.user_id).toLowerCase();
      return an.localeCompare(bn);
    });
  }, [rows]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      expired: rows.filter((r) => r.status === 'expired').length,
      revoked: rows.filter((r) => r.status === 'revoked').length,
      full: rows.filter((r) => r.is_full && r.status === 'active').length,
    }),
    [rows],
  );

  const revoke = useCallback(
    async (id: string, reason?: string) => {
      // Step-up obrigatório: senha + OTP recentes antes de revogar.
      const log = createClientLogger('mcp.revokeKey', { base: { keyId: id } });
      log.info('start');

      const requestStepUp = () =>
        challenge({
          action: 'mcp_key_revoke',
          actionLabel: 'Revogar chave MCP',
          targetRef: id,
        });
      const token = await requestStepUp();
      if (!token) {
        log.warn('cancelled_by_user');
        return false;
      }

      const attempt = async (tk: string): Promise<boolean> => {
        const { data, error } = await supabase.functions.invoke('mcp-keys-revoke', {
          body: { key_id: id, reason: reason ?? null, step_up_token: tk },
          headers: log.headers(),
        });
        // Tratamento dedicado de step-up: mostra toast com CTA "Refazer verificação".
        if (
          handleStepUpError(data, error, () => {
            void (async () => {
              const fresh = await requestStepUp();
              if (fresh) await attempt(fresh);
            })();
          })
        ) {
          log.warn('step_up_required');
          return false;
        }
        if (error || (data && (data as { error?: string }).error)) {
          log.error('failed', { err: error ?? data });
          toast.error('Erro ao revogar', { description: sanitizeError(error ?? data) });
          return false;
        }
        log.info('ok');
        toast.success('Chave revogada');
        await load();
        return true;
      };

      return attempt(token);
    },
    [load, challenge],
  );

  return {
    rows: filtered,
    allRows: rows,
    loading,
    filters,
    setFilters,
    counts,
    creators,
    reload: load,
    revoke,
  };
}
