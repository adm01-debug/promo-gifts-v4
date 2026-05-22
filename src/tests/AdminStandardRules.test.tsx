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

  Object.entries(adminPageModules).forEach(([path, module]: [string, unknown]) => {
    const Component = (module as Record<string, unknown>).default;
    if (typeof Component !== 'function') return;
    const PageComponent = Component as React.ComponentType;

    const pageName = path.split('/').pop()?.replace('.tsx', '');

    it(`${pageName} should render with correct PageSEO config`, async () => {
      render(<PageComponent />, { wrapper });

      // We look for the SEO marker. Since it's often conditional or inside MainLayout,
      // we use findBy to allow for hydration/state resolution.
      const seo = await screen.findByTestId('page-seo', {}, { timeout: 3000 });
      expect(seo, `Page ${pageName} is missing PageSEO`).not.toBeNull();

      // Basic title check - should not be empty
      expect(seo?.getAttribute('data-title')).not.toBe('');
    });

    it(`${pageName} should use standard max-w classes in its layout container`, () => {
      const { container: renderRoot } = render(<PageComponent />, { wrapper });
      const mainContent = screen.queryByRole('main');

      // The page might or might not render its own <main>. When rendered
      // standalone in tests (no MainLayout wrapper) we accept the max-w
      // container anywhere in the render tree; in real usage MainLayout
      // wraps it inside <main>.
      const searchRoot: HTMLElement = mainContent ?? renderRoot;
      const container = searchRoot.querySelector('[class*="max-w-"]');
      expect(container, `Page ${pageName} missing standardized max-w container`).not.toBeNull();
      expect(container?.className ?? '').toContain('mx-auto');
    });
  });
});
