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

vi.mock('@/integrations/supabase/client', () => {
  // QA: builder fluente que cobre todos os métodos PostgREST usados pelas
  // páginas admin (notavelmente .like() em AdminConexoesStatusPage). Cada
  // método retorna o próprio builder, e a resolução final entrega
  // { data: null, error: null } — comportamento "vazio mas válido".
  const makeBuilder = () => {
    const builder: Record<string, unknown> = {};
    const chainable = [
      'select',
      'insert',
      'update',
      'upsert',
      'delete',
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'like',
      'ilike',
      'is',
      'in',
      'contains',
      'containedBy',
      'rangeGt',
      'rangeGte',
      'rangeLt',
      'rangeLte',
      'rangeAdjacent',
      'overlaps',
      'textSearch',
      'match',
      'not',
      'or',
      'filter',
      'order',
      'limit',
      'range',
      'abortSignal',
      'returns',
    ];
    for (const m of chainable) builder[m] = vi.fn(() => builder);
    builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
    builder.csv = vi.fn().mockResolvedValue({ data: '', error: null });
    builder.then = (cb: (v: { data: null; error: null }) => unknown) =>
      Promise.resolve(cb({ data: null, error: null }));
    return builder;
  };
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi
          .fn()
          .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: vi.fn(() => makeBuilder()),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
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
  };
});

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
