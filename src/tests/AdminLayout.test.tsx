import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminConexoesPage from '@/pages/admin/AdminConexoesPage';
import AdminConexoesStatusPage from '@/pages/admin/AdminConexoesStatusPage';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HelmetProvider } from 'react-helmet-async';
import { AriaLiveProvider } from '@/components/a11y/AriaLive';

// Mock das hooks que dependem de rede/Supabase
vi.mock('@/hooks/admin', () => ({
  useSecretsManager: () => ({
    secrets: [],
    list: vi.fn(),
    refreshCache: vi.fn(),
    getRotationHistory: vi.fn().mockResolvedValue([]),
    isLoading: false,
  }),
  useRetestCooldownSetting: () => ({
    cooldownMs: 3000,
    loading: false,
    saving: false,
    save: vi.fn(),
  }),
  RETEST_COOLDOWN_PRESETS_MS: [3000, 10000, 30000, 60000],
}));

vi.mock('@/components/admin/connections/useSeverityChangeNotifier', () => ({
  useSeverityChangeNotifier: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}));

// Mock do SidebarReorganized para verificar se ele é renderizado
vi.mock('@/components/layout/SidebarReorganized', () => ({
  SidebarReorganized: () => <div data-testid="sidebar">Sidebar</div>,
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <HelmetProvider>
      <TooltipProvider>
        <AriaLiveProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <ThemeProvider>
                <AuthProvider>{ui}</AuthProvider>
              </ThemeProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </AriaLiveProvider>
      </TooltipProvider>
    </HelmetProvider>,
  );
};

// The admin pages no longer wrap themselves in MainLayout — the wrapper
// is provided by the router (Outlet pattern), so a standalone test render
// of `<AdminConexoesPage />` doesn't include the sidebar by design.
// Either move these assertions to a routing test that mounts the actual
// Routes tree, or assert the page-level structural marker instead.
describe.skip('Admin Layout Standardization (legacy — moved to routing tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AdminConexoesPage deve renderizar dentro do MainLayout (com sidebar)', async () => {
    renderWithProviders(<AdminConexoesPage />);
    expect(await screen.findByTestId('sidebar', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getAllByText(/Conexões/i).length).toBeGreaterThan(0);
  });

  it('AdminConexoesStatusPage deve renderizar dentro do MainLayout (com sidebar)', async () => {
    renderWithProviders(<AdminConexoesStatusPage />);
    expect(await screen.findByTestId('sidebar', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/Status da sincronização/i)).toBeInTheDocument();
  });
});
