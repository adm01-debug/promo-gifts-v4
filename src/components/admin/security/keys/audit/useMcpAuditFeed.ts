/**
 * Hook do feed de auditoria de chaves MCP.
 * Lê admin_audit_log filtrado por resource_type='mcp_api_key', cruza com profiles
 * para exibir email do ator. Suporta filtros de ação, ator, período, keyId, "só FULL".
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type AuditAction =
  | 'mcp_key.auto_revoked'
  | 'mcp_key.issue_denied'
  | 'mcp_key.issue_error'
  | 'mcp_key.issued'
  | 'mcp_key.revoke_denied'
  | 'mcp_key.revoke_error'
  | 'mcp_key.revoked'
  | 'mcp_key.rotate_denied'
  | 'mcp_key.rotate_error'
  | 'mcp_key.rotated'
  | 'mcp_key.scope_escalated'
  | 'mcp_key.update_denied'
  | 'mcp_key.update_error'
  | 'mcp_key.updated'
  | 'mcp_tool.denied'
  | 'mcp_tool.error'
  | 'mcp_tool.granted';

export interface AuditFeedRow {
  id: string;
  action: AuditAction | string;
  user_id: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  // Novos campos enriquecidos
  request_id?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  status?: 'denied' | 'error' | 'partial' | 'success' | null;
  payload_summary?: Record<string, unknown> | null;
  source?: string | null;
  // Derivados
  actor_email?: string | null;
  actor_name?: string | null;
  key_prefix?: string | null;
  is_full?: boolean;
  escalated?: boolean;
}

export interface AuditFilters {
  action: AuditAction | 'all';
  query: string;
  onlyFull: boolean;
  keyId?: string;
  fromDate?: string;
}

const PAGE_SIZE = 50;

export function useMcpAuditFeed() {
  const [rows, setRows] = useState<AuditFeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditFilters>({
    action: 'all',
    query: '',
    onlyFull: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('admin_audit_log')
      .select(
        'id, action, user_id, resource_id, ip_address, user_agent, details, created_at, request_id, started_at, finished_at, duration_ms, status, payload_summary, source',
      )
      .eq('resource_type', 'mcp_api_key')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE * 4);

    if (filters.action !== 'all') q = q.eq('action', filters.action);
    if (filters.keyId) q = q.eq('resource_id', filters.keyId);
    if (filters.fromDate) q = q.gte('created_at', filters.fromDate);

    const { data, error } = await q;
    if (error) {
      setRows([]);
      setLoading(false);
      return;
    }

    const base = (data ?? []) as AuditFeedRow[];
    const userIds = [...new Set(base.map((r) => r.user_id).filter(Boolean))] as string[];
    const profiles: Record<string, { email?: string | null; full_name?: string | null }> = {};
    if (userIds.length > 0) {
      // BUG-MCPAUDITFEED-PROFILES-SELECT-SILENT-FAIL FIX: { data: profs } without error
      // check — RLS failure silently left actor_email/actor_name null on all feed rows.
      const { data: profs, error: profsErr } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);
      if (profsErr) {
        logger.warn('[useMcpAuditFeed] profile enrichment failed — actor info unavailable:', profsErr);
      } else {
        (profs ?? []).forEach(
          (p: { user_id: string | null; email?: string | null; full_name?: string | null }) => {
            if (p.user_id) profiles[p.user_id] = { email: p.email, full_name: p.full_name };
          },
        );
      }
    }

    const enriched = base.map<AuditFeedRow>((r) => {
      const d = (r.details ?? {}) as Record<string, unknown>;
      const scopes = (d.scopes ?? (d.after as Record<string, unknown>)?.scopes ?? []) as string[];
      const isFull = (Array.isArray(scopes) && scopes.includes('*')) || d.is_full_access === true;
      const escalated = d.escalated_to_full === true || r.action === 'mcp_key.scope_escalated';
      const prof = r.user_id ? profiles[r.user_id] : undefined;
      return {
        ...r,
        actor_email: prof?.email ?? null,
        actor_name: prof?.full_name ?? null,
        key_prefix: (d.key_prefix as string | undefined) ?? null,
        is_full: isFull,
        escalated,
      };
    });

    setRows(enriched);
    setLoading(false);
  }, [filters.action, filters.keyId, filters.fromDate]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filters.onlyFull && !r.is_full) return false;
      if (filters.query) {
        const q = filters.query.toLowerCase();
        const hay =
          `${r.actor_email ?? ''} ${r.actor_name ?? ''} ${r.key_prefix ?? ''} ${r.action}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters.onlyFull, filters.query]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      issued: rows.filter((r) => r.action === 'mcp_key.issued').length,
      rotated: rows.filter((r) => r.action === 'mcp_key.rotated').length,
      updated: rows.filter((r) => r.action === 'mcp_key.updated').length,
      revoked: rows.filter((r) => r.action === 'mcp_key.revoked').length,
      escalated: rows.filter((r) => r.escalated).length,
    }),
    [rows],
  );

  return { rows: filtered, allRows: rows, loading, filters, setFilters, counts, reload: load };
}
