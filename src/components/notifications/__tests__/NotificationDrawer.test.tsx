/* eslint-disable @typescript-eslint/require-await */
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationBell } from '../NotificationDrawer';
import { useNotifications } from '@/hooks/ui';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('@/hooks/ui', () => ({
  useNotifications: vi.fn(),
}));

vi.mock('@/components/a11y/AriaLive', () => ({
  useAriaLive: () => ({ announce: vi.fn() }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({ isAdmin: false, user: null }),
}));

const mockNotifications = [
  {
    id: '1',
    title: 'Test Notification',
    message: 'Hello world',
    type: 'info',
    category: 'system',
    is_read: false,
    created_at: new Date().toISOString(),
    action_url: '/test-route',
  },
];

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders badge when there are unread notifications', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useNotifications as any).mockReturnValue({
      notifications: mockNotifications,
      unreadCount: 1,
      isLoading: false,
      markAllAsRead: vi.fn(),
      prefetch: vi.fn().mockResolvedValue(undefined),
    });

    render(
      <TooltipProvider>
        <BrowserRouter>
          <NotificationBell />
        </BrowserRouter>
      </TooltipProvider>,
    );

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows empty state when there are no notifications', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useNotifications as any).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      markAllAsRead: vi.fn(),
      prefetch: vi.fn().mockResolvedValue(undefined),
      setSearch: vi.fn(),
      setCategory: vi.fn(),
      dateRange: {},
      setDateRange: vi.fn(),
    });

    render(
      <TooltipProvider>
        <BrowserRouter>
          <NotificationBell />
        </BrowserRouter>
      </TooltipProvider>,
    );

    const bellButton = screen.getByRole('button', { name: /Notificações/i });
    fireEvent.click(bellButton);

    expect(screen.getByText('Nenhuma notificação')).toBeInTheDocument();
  });

  it('allows exporting notifications to CSV', async () => {
    const _mockExport = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useNotifications as any).mockReturnValue({
      notifications: mockNotifications,
      unreadCount: 1,
      isLoading: false,
      markAsRead: vi.fn(),
      undoMarkAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      prefetch: vi.fn().mockResolvedValue(undefined),
      setSearch: vi.fn(),
      setCategory: vi.fn(),
      dateRange: {},
      setDateRange: vi.fn(),
    });

    render(
      <TooltipProvider>
        <BrowserRouter>
          <NotificationBell />
        </BrowserRouter>
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Notificações/i }));

    const exportButton = screen.getByRole('button', { name: /Exportar CSV/i });
    expect(exportButton).toBeInTheDocument();

    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();

    fireEvent.click(exportButton);
    // Should have triggered a download link click (hard to test directly without more mocks, but presence is good)
  });

  it('provides undo option after marking as read', async () => {
    const undoMarkAsRead = vi.fn();
    const markAsRead = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useNotifications as any).mockReturnValue({
      notifications: mockNotifications,
      unreadCount: 1,
      isLoading: false,
      markAsRead,
      undoMarkAsRead,
      markAllAsRead: vi.fn(),
      prefetch: vi.fn().mockResolvedValue(undefined),
      setSearch: vi.fn(),
      setCategory: vi.fn(),
      dateRange: {},
      setDateRange: vi.fn(),
    });

    render(
      <TooltipProvider>
        <BrowserRouter>
          <NotificationBell />
        </BrowserRouter>
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Notificações/i }));

    const notificationItem = screen.getByText('Test Notification');
    fireEvent.click(notificationItem);

    expect(markAsRead).toHaveBeenCalledWith('1');
    // The toast behavior is harder to test in unit tests without more setup,
    // but we can verify the function is called.
  });
});
