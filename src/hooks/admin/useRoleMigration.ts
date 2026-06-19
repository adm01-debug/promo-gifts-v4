/**
 * useRoleMigration
 * ----------------------------------------------------------------------------
 * Hook que encapsula a RPC `execute_role_migration_batch` + leitura do
 * histórico (`role_migration_batches` + `role_migration_items`).
 *
 * Toda escrita é feita pela RPC (SECURITY DEFINER + admin estrito); o cliente
 * nunca toca diretamente nas tabelas — RLS bloqueia INSERT/UPDATE/DELETE.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type AppRole = Database['public']['Enums']['app_role'];
export type BatchStatus = Database['public']['Enums']['role_migration_status'];
export type ItemStatus = Database['public']['Enums']['role_migration_item_status'];

export interface MigrationItemInput {
  user_id: string;
  to_role: AppRole;
  operation: 'add' | 'remove' | 'replace';
}

export interface BatchRow {
  id: string;
  label: string;
  reason: string;
  initiated_by: string;
  dry_run: boolean;
  status: BatchStatus;
  total_items: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface ItemRow {
  id: string;
  batch_id: string;
  user_id: string;
  user_email: string | null;
  from_role: AppRole | null;
  to_role: AppRole;
  operation: string;
  status: ItemStatus;
  error_message: string | null;
  duration_ms: number | null;
  processed_at: string | null;
}

export function useRoleMigration() {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refreshBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const { data, error } = await supabase
        .from('role_migration_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setBatches(data ?? []);
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    void refreshBatches();
  }, [refreshBatches]);

  const executeBatch = useCallback(
    async (params: {
      label: string;
      reason: string;
      items: MigrationItemInput[];
      dryRun: boolean;
    }) => {
      setSubmitting(true);
      try {
        const { data, error } = await supabase.rpc('execute_role_migration_batch', {
          _label: params.label,
          _reason: params.reason,
          _items:
            params.items as unknown as Database['public']['Tables']['role_migration_items']['Row'][],
          _dry_run: params.dryRun,
        });
        if (error) throw error;
        await refreshBatches();
        return data; // batch_id
      } finally {
        setSubmitting(false);
      }
    },
    [refreshBatches],
  );

  const fetchItems = useCallback(async (batchId: string): Promise<ItemRow[]> => {
    const { data, error } = await supabase
      .from('role_migration_items')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }, []);

  return { batches, loadingBatches, submitting, refreshBatches, executeBatch, fetchItems };
}
