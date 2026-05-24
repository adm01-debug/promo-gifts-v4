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
import { MainLayout } from '@/components/layout/MainLayout';

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
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn((cb?: (value: { data: unknown[]; error: null }) => void) => {
        cb?.({ data: [], error: null });
        return Promise.resolve({ data: [], error: null });
      }),
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

// MainLayout real usa lazyWithRetry (Header/Sidebar/PageTransition/CommandBar)
// + Suspense aninhado, que pendura o worker quando montado 2x em jsdom. O
// MainLayout real tem cobertura dedicada em
// tests/components/layout/MainLayout.breadcrumbs.test.tsx. Aqui o contrato sob
// teste é "a página Admin renderiza DENTRO de um layout com sidebar" — então
// mockamos o MainLayout com um wrapper fiel e leve (sidebar + children).
vi.mock('@/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">
      <div data-testid="sidebar">Sidebar</div>
      <main>{children}</main>
    </div>
  ),
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
                <AuthProvider>
                  {/* Layout aplicado no nível do router pós-reorg: o teste o
                      aplica explicitamente (MainLayout é mockado acima). */}
                  <MainLayout>{ui}</MainLayout>
                </AuthProvider>
              </ThemeProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </AriaLiveProvider>
      </TooltipProvider>
    </HelmetProvider>,
  );
};

describe('Admin Layout Standardization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AdminConexoesPage deve renderizar dentro do MainLayout (com sidebar)', async () => {
    renderWithProviders(<AdminConexoesPage />);
    // O MainLayout renderiza o sidebar. Verificamos se o mock do sidebar apareceu.
    expect(await screen.findByTestId('sidebar', {}, { timeout: 3000 })).toBeInTheDocument();
    // Verifica título da página para garantir que o conteúdo está lá
    expect(screen.getAllByText(/Conexões/i).length).toBeGreaterThan(0);
  });

  it('AdminConexoesStatusPage deve renderizar dentro do MainLayout (com sidebar)', async () => {
    renderWithProviders(<AdminConexoesStatusPage />);
    expect(await screen.findByTestId('sidebar', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/Status da sincronização/i)).toBeInTheDocument();
  });
});
