import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import QuoteBuilderPage from '../../src/pages/quotes/QuoteBuilderPage';
import { useComparisonStore } from '../../src/stores/useComparisonStore';
import { TooltipProvider } from '../../src/components/ui/tooltip';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fs from 'fs';
import path from 'path';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

window.scrollTo = vi.fn();

// Mocks consolidados
vi.mock('../../src/components/a11y/AriaLive', () => ({
  useAriaLive: () => ({ announce: vi.fn(), announceStatus: vi.fn() }),
  AriaLiveProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isAuthenticated: true, role: 'agente' }),
  AuthProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/contexts/OnboardingContext', () => ({
  useOnboarding: () => ({ isTourOpen: false }),
  useOnboardingContext: () => ({ isTourOpen: false }),
  useOptionalOnboardingContext: () => null,
  OnboardingProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/contexts/SellerCartContext', () => ({
  useSellerCart: () => ({ items: [] }),
  SellerCartProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ organization: { id: 'org-123' }, isLoading: false }),
  OrganizationProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/integrations/supabase/client', () => {
  const chain = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    then: vi.fn().mockImplementation((cb) => Promise.resolve({ data: [] }).then(cb)),
  };
  return {
    supabase: {
      auth: { 
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
      },
      from: vi.fn().mockReturnValue(chain), rpc: vi.fn().mockResolvedValue({ data: [] }),
      functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) }
    },
  };
});

vi.mock('../../src/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: any) => <div data-testid="main-layout">{children}</div>,
}));

const saveVisualEvidence = (name: string, container: HTMLElement) => {
  const artifactDir = 'tests/e2e/artifacts/quotes/visual';
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, `${name}.html`), container.innerHTML);
};

describe('Módulo Novo Orçamento - Avançado Final', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  const renderPage = async () => {
    const res = render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <BrowserRouter>
            <TooltipProvider>
              <QuoteBuilderPage />
            </TooltipProvider>
          </BrowserRouter>
        </HelmetProvider>
      </QueryClientProvider>
    );
    await waitFor(() => {});
    return res;
  };

  it('Integridade: Carrega título da página e indica salvamento', async () => {
    await renderPage();
    expect(await screen.findByText(/Novo Orçamento/i)).toBeInTheDocument();
    expect(screen.getByText(/Salvo automaticamente/i)).toBeInTheDocument();
  });

  it('Estrutura: Valida seções principais por headings', async () => {
    await renderPage();
    const headings = screen.getAllByRole('heading');
    const hasItens = headings.some(h => /Itens/i.test(h.textContent || ''));
    expect(hasItens).toBeTruthy();
  });

  it('Viewer: Gera artefatos visuais para auditoria CI', async () => {
    const { container } = await renderPage();
    saveVisualEvidence('quote-builder-initial', container);
    expect(fs.existsSync('tests/e2e/artifacts/quotes/visual/quote-builder-initial.html')).toBe(true);
  });
});

