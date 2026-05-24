import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HelmetProvider } from 'react-helmet-async';
import React from 'react';

// Mock specific logic
vi.mock('@/contexts/DevChallengeContext', () => ({
  DevChallengeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDevChallenge: () => ({
    challenge: null,
    isLoading: false,
    markStepCompleted: vi.fn(),
    isStepCompleted: vi.fn().mockReturnValue(false),
  }),
}));

// Mock useAuth to force supervisor status so PageSEO always renders
vi.mock('@/contexts/AuthContext', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 'test-user-id', role: 'admin' },
      isSupervisorOrAbove: true,
      isAdmin: true,
      isLoading: false,
    }),
  };
});

// Partially mocking MainLayout to ensure stability in CI
vi.mock('@/components/layout/MainLayout', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    MainLayout: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="main-layout" role="document">
        <nav aria-label="Menu principal">Mock Sidebar</nav>
        <main role="main">{children}</main>
      </div>
    ),
  };
});

// Prevent StorageTestPage and other admin pages from making real Supabase
// network calls during render — these cause unhandled rejections in jsdom
// CI with no live server. Uses a Proxy-based chainable mock so every
// .select().eq().maybeSingle() (and any other builder combo) resolves safely.
vi.mock('@/integrations/supabase/client', () => {
  const resolved = { data: null, error: null };

  function makeChainable(): object {
    const p = Promise.resolve(resolved);
    const handler: ProxyHandler<object> = {
      get(_t, prop) {
        if (prop === 'then') return p.then.bind(p);
        if (prop === 'catch') return p.catch.bind(p);
        if (prop === 'finally') return p.finally.bind(p);
        return () => makeChainable();
      },
    };
    return new Proxy({}, handler);
  }

  const channelMock = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  };

  return {
    supabase: {
      from: () => makeChainable(),
      rpc: vi.fn().mockResolvedValue(resolved),
      storage: {
        from: () => ({
          list: vi.fn().mockResolvedValue({ data: [], error: null }),
          upload: vi.fn().mockResolvedValue({ data: null, error: null }),
          download: vi.fn().mockResolvedValue({ data: null, error: null }),
          remove: vi.fn().mockResolvedValue({ data: null, error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
        }),
      },
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
      channel: vi.fn().mockReturnValue(channelMock),
      removeChannel: vi.fn().mockResolvedValue(undefined),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  };
});

// Capture PageSEO props
const seoCaptures: Record<string, Record<string, unknown>> = {};
vi.mock('@/components/seo/PageSEO', () => ({
  PageSEO: (props: Record<string, unknown>) => {
    const pageName = window.location.pathname;
    seoCaptures[pageName] = props;
    return <div data-testid="page-seo" data-title={props.title as string} />;
  },
}));

// Import all admin pages
const adminPageModules = import.meta.glob('@/pages/admin/*.tsx', { eager: true });

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    </HelmetProvider>
  </QueryClientProvider>
);

describe('Admin Module Programmatic Standard Rules', () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = (...args) => {
      if (
        args[0]?.toString().includes('act(...)') ||
        args[0]?.toString().includes('HelmetProvider')
      )
        return;
      originalError(...args);
    };
  });
  afterAll(() => {
    console.error = originalError;
  });

  // T-FIX-4: refatorado de `forEach(...) { it(...) }` para `describe.each`.
  // O padrão anterior funcionava (cada it era registrado individualmente),
  // mas describe.each é mais idiomático no Vitest e gera labels limpos no
  // reporter ("Page X > renders PageSEO" em vez de "X renders PageSEO").
  const adminPages = Object.entries(adminPageModules)
    .map(([path, mod]: [string, unknown]) => {
      const component = (mod as Record<string, unknown>).default;
      const pageName = path.split('/').pop()?.replace('.tsx', '') ?? 'unknown';
      return { pageName, component };
    })
    .filter(({ component }) => typeof component === 'function')
    .map(({ pageName, component }) => ({
      pageName,
      pageComponent: component as React.ComponentType,
    }));

  describe.each(adminPages)('Page $pageName', (page) => {
    const { pageName, pageComponent: PageComponent } = page;
    it('should render with correct PageSEO config', async () => {
      render(<PageComponent />, { wrapper });

      // We look for the SEO marker. Since it's often conditional or inside MainLayout,
      // we use findBy to allow for hydration/state resolution.
      const seo = await screen.findByTestId('page-seo', {}, { timeout: 3000 });
      expect(seo, `Page ${pageName} is missing PageSEO`).not.toBeNull();

      // Basic title check - should not be empty
      expect(seo?.getAttribute('data-title')).not.toBe('');
    });

    it('should use standard max-w classes in its layout container', () => {
      const { container: renderRoot } = render(<PageComponent />, { wrapper });

      // Admin pages são fragmentos de conteúdo wrapped pela MainLayout
      // externamente (no router). Por isso buscamos o container padronizado
      // em todo o output renderizado, não apenas dentro de <main>.
      // O seletor composto [class*="max-w-"][class*="mx-auto"] garante que
      // ambas as classes estão no MESMO elemento (single source of truth).
      const container = renderRoot.querySelector('[class*="max-w-"][class*="mx-auto"]');
      expect(
        container,
        `Page ${pageName} está faltando um container padronizado com 'max-w-*' e 'mx-auto' juntos no mesmo elemento.`,
      ).not.toBeNull();
    });
  });
});
