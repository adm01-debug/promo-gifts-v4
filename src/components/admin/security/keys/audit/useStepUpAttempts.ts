/**
 * Hook para listar tentativas de concessão FULL bloqueadas por step-up.
 * Filtra admin_audit_log por resource_type='mcp_api_key', status='denied' e
 * details.reason ∈ {step_up_required, step_up_invalid}. Suporta filtros por
 * usuário (email/nome/uid) e por chave (resource_id).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type StepUpReason = 'step_up_required' | 'step_up_invalid';

export interface StepUpAttemptRow {
  id: string;
  action: string;
  user_id: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  request_id?: string | null;
  source?: string | null;
  // derivados
  reason: StepUpReason | string;
  scope?: string | null;
  detail?: string | null;
  expected_action?: string | null;
  actor_email?: string | null;
  actor_name?: string | null;
  key_prefix?: string | null;
  key_name?: string | null;
}

export interface StepUpFilters {
  reason: 'all' | StepUpReason;
  userQuery: string;
  keyId: string;
  fromDate?: string;
}

const REASONS: StepUpReason[] = ['step_up_required', 'step_up_invalid'];
const ACTIONS = ['mcp_key.issue_denied', 'mcp_key.rotate_denied', 'mcp_key.update_denied'];

export function useStepUpAttempts() {
  const [allRows, setAllRows] = useState<StepUpAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<StepUpFilters>({
    reason: 'all',
    userQuery: '',
    keyId: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('admin_audit_log')
      .select(
        'id, action, user_id, resource_id, ip_address, user_agent, details, created_at, request_id, source, status',
      )
      .eq('resource_type', 'mcp_api_key')
      .eq('status', 'denied')
      .in('action', ACTIONS)
      .order('created_at', { ascending: false })
      .limit(200);

    if (filters.fromDate) q = q.gte('created_at', filters.fromDate);
    if (filters.keyId) q = q.eq('resource_id', filters.keyId);

    const { data, error } = await q;
    if (error) {
      setAllRows([]);
      setLoading(false);
      return;
    }

    const base = (data ?? []) as Array<Omit<StepUpAttemptRow, 'reason'>>;
    // Filtra por reason no cliente (json field)
    const onlyStepUp = base.filter((r) => {
      const reason = r.details?.reason as string | undefined;
      return reason && REASONS.includes(reason as StepUpReason);
    });

    const userIds = [...new Set(onlyStepUp.map((r) => r.user_id).filter(Boolean))] as string[];
    const keyIds = [...new Set(onlyStepUp.map((r) => r.resource_id).filter(Boolean))] as string[];

    const [profilesRes, keysRes] = await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('user_id, email, full_name').in('user_id', userIds)
        : Promise.resolve({
            data: [] as Array<{
              user_id: string;
              email?: string | null;
              full_name?: string | null;
            }>,
          }),
      keyIds.length
        ? supabase.from('mcp_api_keys').select('id, name, key_prefix').in('id', keyIds)
        : Promise.resolve({
            data: [] as Array<{ id: string; name?: string | null; key_prefix?: string | null }>,
          }),
    ]);

    const profiles: Record<string, { email?: string | null; full_name?: string | null }> = {};
    (profilesRes.data ?? []).forEach((p) => {
      if (p.user_id) profiles[p.user_id] = { email: p.email, full_name: p.full_name };
    });
    const keys: Record<string, { name?: string | null; key_prefix?: string | null }> = {};
    (keysRes.data ?? []).forEach((k) => {
      keys[k.id] = { name: k.name, key_prefix: k.key_prefix };
    });

    const enriched: StepUpAttemptRow[] = onlyStepUp.map((r) => {
      const d = r.details ?? {};
      const prof = r.user_id ? profiles[r.user_id] : undefined;
      const key = r.resource_id ? keys[r.resource_id] : undefined;
      return {
        ...r,
        reason: String(d.reason ?? '') as StepUpReason,
        scope: (d.scope as string | undefined) ?? null,
        detail: (d.detail as string | undefined) ?? null,
        expected_action: (d.expected_action as string | undefined) ?? null,
        actor_email: prof?.email ?? null,
        actor_name: prof?.full_name ?? null,
        key_prefix: key?.key_prefix ?? null,
        key_name: key?.name ?? null,
      };
    });

    setAllRows(enriched);
    setLoading(false);
  }, [filters.fromDate, filters.keyId]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    return allRows.filter((r) => {
      if (filters.reason !== 'all' && r.reason !== filters.reason) return false;
      if (filters.userQuery) {
        const q = filters.userQuery.toLowerCase();
        const hay = `${r.actor_email ?? ''} ${r.actor_name ?? ''} ${r.user_id ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, filters.reason, filters.userQuery]);

  const counts = useMemo(
    () => ({
      total: allRows.length,
      required: allRows.filter((r) => r.reason === 'step_up_required').length,
      invalid: allRows.filter((r) => r.reason === 'step_up_invalid').length,
      issue: allRows.filter((r) => r.action === 'mcp_key.issue_denied').length,
      rotate: allRows.filter((r) => r.action === 'mcp_key.rotate_denied').length,
      update: allRows.filter((r) => r.action === 'mcp_key.update_denied').length,
    }),
    [allRows],
  );

  return { rows, allRows, loading, filters, setFilters, counts, reload: load };
}
