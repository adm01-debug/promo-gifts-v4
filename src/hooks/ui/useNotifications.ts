/**
 * useNotifications — Hook unificado de notificações
 *
 * Façade pública que padroniza a API de notificações do app.
 * Encapsula:
 *  - useWorkspaceNotifications (in-app, tabela `workspace_notifications`)
 *  - usePushNotifications (Web Push API + Service Worker)
 *
 * Use este hook em vez dos hooks internos para garantir compatibilidade
 * futura caso a implementação subjacente mude.
 */
import { useWorkspaceNotifications, type WorkspaceNotification } from "./useWorkspaceNotifications";
import { usePushNotifications } from "./usePushNotifications";

export type { WorkspaceNotification };

export interface UseNotificationsReturn {
  // In-app
  notifications: WorkspaceNotification[];
  unreadCount: number;
  isLoading: boolean;
  isRefetching: boolean;
  isMutationRehydrating: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
  prefetch: () => Promise<void>;

  // Push (Web Push API)
  push: ReturnType<typeof usePushNotifications>;
}

export function useNotifications(): UseNotificationsReturn {
  const workspace = useWorkspaceNotifications();
  const push = usePushNotifications();

  return {
    notifications: workspace.notifications,
    unreadCount: workspace.unreadCount,
    isLoading: workspace.isLoading,
    isRefetching: workspace.isRefetching,
    isMutationRehydrating: workspace.isMutationRehydrating,
    markAsRead: workspace.markAsRead,
    markAllAsRead: workspace.markAllAsRead,
    clearAll: workspace.clearAll,
    refresh: workspace.refresh,
    prefetch: workspace.prefetch,
    push,
  };
}
