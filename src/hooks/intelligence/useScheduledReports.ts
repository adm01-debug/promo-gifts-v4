import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
export type ReportFrequency = 'daily' | 'weekly' | 'monthly';
export type ReportType = 'sales' | 'quotes' | 'clients' | 'products' | 'orders';

export interface ScheduledReport {
  id: string;
  user_id: string;
  report_type: ReportType;
  frequency: ReportFrequency;
  email_to: string;
  report_name: string;
  filters: Record<string, unknown>;
  is_active: boolean;
  last_sent_at: string | null;
  next_run_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReportInput {
  report_type: ReportType;
  frequency: ReportFrequency;
  email_to: string;
  report_name: string;
  filters?: Record<string, unknown>;
}

const FREQUENCY_LABELS: Record<ReportFrequency, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  sales: 'Vendas',
  quotes: 'Orçamentos',
  clients: 'Clientes',
  products: 'Produtos',
  orders: 'Pedidos',
};

export function useScheduledReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports((data ?? []) as unknown as ScheduledReport[]);
    } catch (err) {
      logger.error('Error fetching scheduled reports:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const createReport = useCallback(
    async (input: CreateReportInput): Promise<boolean> => {
      if (!user) {
        toast.error('Usuário não autenticado');
        return false;
      }

      try {
        const nextRun = calculateNextRun(input.frequency);
        const { error } = await supabase.from('scheduled_reports').insert({
          user_id: user.id,
          report_type: input.report_type,
          frequency: input.frequency,
          email_to: input.email_to,
          report_name: input.report_name,
          // filters holds user-defined report criteria persisted as JSON
          filters: (input.filters ?? {}) as unknown as Json,
          next_run_at: nextRun.toISOString(),
        });

        if (error) throw error;
        toast.success('Relatório agendado criado!', {
          description: `${REPORT_TYPE_LABELS[input.report_type]} — ${FREQUENCY_LABELS[input.frequency]}`,
        });
        await fetchReports();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao criar relatório';
        toast.error('Erro ao agendar relatório', { description: msg });
        return false;
      }
    },
    [user, fetchReports],
  );

  const toggleActive = useCallback(async (reportId: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('scheduled_reports')
        .update({ is_active: active, updated_at: new Date().toISOString() })
        .eq('id', reportId);

      if (error) throw error;
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, is_active: active } : r)));
      toast.success(active ? 'Relatório ativado' : 'Relatório pausado');
    } catch {
      toast.error('Erro ao atualizar relatório');
    }
  }, []);

  const deleteReport = useCallback(async (reportId: string) => {
    try {
      const { error } = await supabase.from('scheduled_reports').delete().eq('id', reportId);

      if (error) throw error;
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      toast.success('Relatório excluído');
    } catch {
      toast.error('Erro ao excluir relatório');
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return {
    reports,
    isLoading,
    createReport,
    toggleActive,
    deleteReport,
    fetchReports,
    FREQUENCY_LABELS,
    REPORT_TYPE_LABELS,
  };
}

function calculateNextRun(frequency: ReportFrequency): Date {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'monthly': {
      const next = new Date(now);
      next.setMonth(next.getMonth() + 1);
      return next;
    }
  }
}
