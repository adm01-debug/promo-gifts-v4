import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Header } from '../Header';
import { SidebarReorganized } from '../SidebarReorganized';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SellerCartProvider } from '@/contexts/SellerCartContext';
import { AriaLiveProvider } from '@/components/a11y/AriaLive';

// Mocks de hooks e contexts
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'dark',
    actualTheme: 'dark',
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
    isFallback: false,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    profile: { display_name: 'Test User' },
    role: 'admin',
    isAdmin: true,
    signOut: vi.fn(),
    rolesLoaded: true,
  }),
}));

vi.mock('@/contexts/OnboardingContext', () => ({
  useOnboardingContext: () => ({
    restartTour: vi.fn(),
    hasCompletedTour: true,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/stores/useFavoritesStore', () => ({
  useFavoritesStore: (selector: any) => selector({ favoriteCount: 5 }),
}));

vi.mock('@/stores/useComparisonStore', () => ({
  useComparisonStore: (selector: any) => selector({ compareCount: 2 }),
}));

vi.mock('@/hooks/useScroll', () => ({
  useIsScrolled: () => false,
}));

vi.mock('@/hooks/useCurrentSection', () => ({
  useCurrentSection: () => 'products',
}));

// Mock do supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn().mockReturnThis(),
    }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('Integridade de Componentes de Layout', () => {
  it('Header deve ser importado e renderizado sem erros de sintaxe ou runtime básico', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AriaLiveProvider>
            <SellerCartProvider>
              <TooltipProvider>
                <Header 
                  onMenuToggle={vi.fn()} 
                  searchQuery="" 
                  onSearchChange={vi.fn()} 
                />
              </TooltipProvider>
            </SellerCartProvider>
          </AriaLiveProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );
    expect(container).toBeDefined();
  });

  it('SidebarReorganized deve ser importado e renderizado sem erros de sintaxe ou runtime básico', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SidebarReorganized 
            isOpen={true} 
            onToggle={vi.fn()} 
          />
        </BrowserRouter>
      </QueryClientProvider>
    );
    expect(container).toBeDefined();
  });
});
