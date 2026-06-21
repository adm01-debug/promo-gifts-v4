// src/services/notificationService.ts
// BUG-NOTIF-009 FIX: Este arquivo estava referenciado na arquitetura do módulo
// (seção 9.1 do README técnico como "Serviço Principal") mas NÃO EXISTIA no repo.
// Criado do zero com CRUD completo sobre workspace_notifications via Supabase.
import { supabase } from '@/integrations/supabase/client';

import { logger } from '@/lib/logger';
export interface WorkspaceNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  updated_at?: string;
}

export interface GetNotificationsOptions {
  /** Filtrar apenas não lidas. Default: false (retorna todas). */
  unreadOnly?: boolean;
  /** Busca textual (title ou message). */
  search?: string;
  /** Filtro por categoria. */
  category?: string;
  /** Data inicial (ISO). */
  startDate?: string;
  /** Data final (ISO). */
  endDate?: string;
  /** Número máximo de registros. Default: 50. */
  limit?: number;
  /** Offset para paginação. Default: 0. */
  offset?: number;
}

/**
 * Busca notificações do usuário autenticado.
 * Ordena por created_at decrescente (mais recentes primeiro).
 * RLS garante que só retorna registros do user logado.
 */
export async function getNotifications(
  options: GetNotificationsOptions = {},
): Promise<{ data: WorkspaceNotification[]; total: number }> {
  const {
    unreadOnly = false,
    search,
    category,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = options;

  let query = supabase
    .from('workspace_notifications')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  if (search) {
    // BUG-NOTIF-10: Usando search textual via textSearch para melhor performance
    query = query.textSearch('search_vector', search, { config: 'portuguese', type: 'plain' });
  }

  if (startDate) {
    query = query.gte('created_at', startDate);
  }

  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data, error, count } = await query;

  if (error) {
    logger.error('[notificationService] getNotifications error:', error.message);
    throw error;
  }

  return {
    data: (data ?? []) as WorkspaceNotification[],
    total: count ?? 0,
  };
}

/**
 * Conta notificações não lidas do usuário autenticado.
 * Usa count agregado para não baixar os registros completos.
 * Retorna 0 em caso de erro (falha silenciosa — badge não bloqueia a UI).
 */
export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('workspace_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);

  if (error) {
    logger.error('[notificationService] getUnreadCount error:', error.message);
    return 0;
  }

  return count ?? 0;
}

/**
 * Marca uma notificação como lida.
 * Retorna true em caso de sucesso.
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('workspace_notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    logger.error('[notificationService] markAsRead error:', error.message);
    return false;
  }

  return true;
}

/**
 * Marca TODAS as notificações não lidas do usuário como lidas.
 * Retorna a quantidade de registros afetados, ou -1 em caso de erro.
 */
export async function markAllAsRead(): Promise<number> {
  const { data, error } = await supabase
    .from('workspace_notifications')
    .update({ is_read: true })
    .eq('is_read', false)
    .select('id');

  if (error) {
    logger.error('[notificationService] markAllAsRead error:', error.message);
    return -1;
  }

  return data?.length ?? 0;
}

/**
 * Deleta uma notificação pelo ID.
 * Retorna true em caso de sucesso.
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('workspace_notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    logger.error('[notificationService] deleteNotification error:', error.message);
    return false;
  }

  return true;
}

/**
 * Inscreve o cliente em mudanças em tempo real na tabela workspace_notifications
 * para o usuário autenticado (filtrado por user_id via RLS do Supabase).
 *
 * Retorna uma função de limpeza que cancela a subscription.
 *
 * @example
 * const unsubscribe = subscribeToNotifications(
 *   (n) => logger.log('Nova notificação:', n),
 *   (n) => logger.log('Notificação atualizada:', n),
 * );
 * // Na desmontagem do componente:
 * unsubscribe();
 */
export function subscribeToNotifications(
  onInsert: (notification: WorkspaceNotification) => void,
  onUpdate?: (notification: WorkspaceNotification) => void,
): () => void {
  // BUG-RT-CHANNEL FIX: tópico ÚNICO por inscrição (crypto.randomUUID()). Com nome
  // estático, duas chamadas concorrentes de subscribeToNotifications() reaproveitavam
  // o MESMO canal já inscrito no supabase-js e o .on('postgres_changes') era aplicado
  // APÓS subscribe(), lançando "cannot add postgres_changes callbacks ... after
  // subscribe()" — o mesmo crash do canal de quotes (QuoteViewPage).
  const channel = supabase
    .channel(`workspace_notifications_svc_realtime:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'workspace_notifications',
      },
      (payload) => {
        onInsert(payload.new as WorkspaceNotification);
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'workspace_notifications',
      },
      (payload) => {
        onUpdate?.(payload.new as WorkspaceNotification);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
