import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { useToast } from '@/hooks/ui/use-toast';
import { sanitizeError } from '@/lib/security/sanitize-error';

import { logger } from '@/lib/logger';
export interface PasswordResetRequest {
  id: string;
  email: string;
  user_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_notes: string | null;
}

export function usePasswordResetRequests() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchRequests = async () => {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('password_reset_requests')
        .select(
          'id, email, user_id, status, requested_at, reviewed_at, reviewed_by, reviewer_notes',
        )
        .order('requested_at', { ascending: false });

      if (error) throw error;

      setRequests((data as PasswordResetRequest[]) ?? []);
      setPendingCount(data?.filter((r) => r.status === 'pending').length || 0);
    } catch (error) {
      logger.error('Error fetching password reset requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const approveRequest = async (requestId: string, notes?: string) => {
    try {
      // Buscar a solicitação
      const request = requests.find((r) => r.id === requestId);
      if (!request) throw new Error('Solicitação não encontrada');

      // Atualizar status
      const supabase = await getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: updateError } = await supabase
        .from('password_reset_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          reviewer_notes: notes || 'Aprovado',
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Enviar email de reset de senha via Supabase Auth
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(request.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      toast({
        title: 'Solicitação aprovada',
        description: `Email de recuperação enviado para ${request.email}`,
      });

      await fetchRequests();
      return true;
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro ao aprovar',
        description: sanitizeError(error),
      });
      return false;
    }
  };

  const rejectRequest = async (requestId: string, notes?: string) => {
    try {
      const supabase = await getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('password_reset_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          reviewer_notes: notes || 'Rejeitado',
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: 'Solicitação rejeitada',
        description: 'A solicitação de reset de senha foi rejeitada.',
      });

      await fetchRequests();
      return true;
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro ao rejeitar',
        description: sanitizeError(error),
      });
      return false;
    }
  };

  const createRequest = async (email: string) => {
    try {
      // Verificar se já existe uma solicitação pendente para este email
      const supabase = await getSupabaseClient();
      const { data: existing } = await supabase
        .from('password_reset_requests')
        .select('id')
        .eq('email', email)
        .eq('status', 'pending')
        .single();

      if (existing) {
        return {
          success: true,
          message:
            'Já existe uma solicitação pendente para este email. Aguarde a aprovação do gestor.',
        };
      }

      const { error } = await supabase.from('password_reset_requests').insert({ email });

      if (error) throw error;

      return {
        success: true,
        message:
          'Solicitação enviada! Um gestor irá analisar e aprovar seu pedido de recuperação de senha.',
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  };

  return {
    requests,
    isLoading,
    pendingCount,
    approveRequest,
    rejectRequest,
    createRequest,
    refetch: fetchRequests,
  };
}

export default usePasswordResetRequests;
