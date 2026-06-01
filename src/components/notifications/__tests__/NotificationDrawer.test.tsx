import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationBell } from '../NotificationDrawer';
import { useNotifications } from '@/hooks/ui';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

vi.mock('@/hooks/ui', () => ({
  useNotifications: vi.fn(),
}));

vi.mock('@/components/a11y/AriaLive', () => ({
  useAriaLive: () => ({ announce: vi.fn() }),
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
    (useNotifications as any).mockReturnValue({
      notifications: mockNotifications,
      unreadCount: 1,
      isLoading: false,
      markAllAsRead: vi.fn(),
      prefetch: vi.fn(),
    });

    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>
    );

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows empty state when there are no notifications', async () => {
    (useNotifications as any).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      markAllAsRead: vi.fn(),
      prefetch: vi.fn(),
    });

    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>
    );

    const bellButton = screen.getByRole('button', { name: /Notificações/i });
    fireEvent.click(bellButton);

    expect(screen.getByText('Nenhuma notificação')).toBeInTheDocument();
  });
});
