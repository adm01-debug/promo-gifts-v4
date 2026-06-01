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
import {
  useWorkspaceNotifications,
  type WorkspaceNotification,
} from '@/hooks/ui/useWorkspaceNotifications';
import { usePushNotifications } from '@/hooks/ui/usePushNotifications';

export type { WorkspaceNotification };

export interface UseNotificationsReturn {
  // In-app
  notifications: WorkspaceNotification[];
  unreadCount: number;
  totalCount: number;
  isLoading: boolean;
  isRefetching: boolean;
  isMutationRehydrating: boolean;
  markAsRead: (id: string) => Promise<void>;
  undoMarkAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
  prefetch: () => Promise<void>;

  // Filters
  page: number;
  search: string;
  category: string;
  unreadOnly: boolean;
  dateRange: { from: Date | undefined; to: Date | undefined };
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setCategory: (category: string) => void;
  setUnreadOnly: (unreadOnly: boolean) => void;
  setDateRange: (range: { from: Date | undefined; to: Date | undefined }) => void;

  // Push (Web Push API)
  push: ReturnType<typeof usePushNotifications>;
}

export function useNotifications(): UseNotificationsReturn {
  const workspace = useWorkspaceNotifications();
  const push = usePushNotifications();

  return {
    notifications: workspace.notifications,
    unreadCount: workspace.unreadCount,
    totalCount: workspace.totalCount,
    isLoading: workspace.isLoading,
    isRefetching: workspace.isRefetching,
    isMutationRehydrating: workspace.isMutationRehydrating,
    markAsRead: workspace.markAsRead,
    undoMarkAsRead: workspace.undoMarkAsRead,
    markAllAsRead: workspace.markAllAsRead,
    clearAll: workspace.clearAll,
    refresh: workspace.refresh,
    prefetch: workspace.prefetch,
    page: workspace.page,
    search: workspace.search,
    category: workspace.category,
    unreadOnly: workspace.unreadOnly,
    dateRange: workspace.dateRange,
    setPage: workspace.setPage,
    setSearch: workspace.setSearch,
    setCategory: workspace.setCategory,
    setUnreadOnly: workspace.setUnreadOnly,
    setDateRange: workspace.setDateRange,
    push,
  };
}
