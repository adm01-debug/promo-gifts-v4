// src/services/notificationService.ts
// BUG-NOTIF-009 FIX: Este arquivo estava referenciado na arquitetura do módulo
// (seção 9.1 do README técnico como "Serviço Principal") mas NÃO EXISTIA no repo.
// Criado do zero com CRUD completo sobre workspace_notifications via Supabase.
import { supabase } from '@/integrations/supabase/client';

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
): Promise<WorkspaceNotification[]> {
  const { unreadOnly = false, limit = 50, offset = 0 } = options;

  let query = supabase
    .from('workspace_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[notificationService] getNotifications error:', error.message);
    throw error;
  }

  return (data ?? []) as WorkspaceNotification[];
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
    console.error('[notificationService] getUnreadCount error:', error.message);
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
    console.error('[notificationService] markAsRead error:', error.message);
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
    console.error('[notificationService] markAllAsRead error:', error.message);
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
    console.error('[notificationService] deleteNotification error:', error.message);
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
 *   (n) => console.log('Nova notificação:', n),
 *   (n) => console.log('Notificação atualizada:', n),
 * );
 * // Na desmontagem do componente:
 * unsubscribe();
 */
export function subscribeToNotifications(
  onInsert: (notification: WorkspaceNotification) => void,
  onUpdate?: (notification: WorkspaceNotification) => void,
): () => void {
  const channel = supabase
    .channel('workspace_notifications_realtime')
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
