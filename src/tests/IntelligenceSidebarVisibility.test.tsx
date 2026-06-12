import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SidebarReorganized } from '../components/layout/SidebarReorganized';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '../components/ui/tooltip';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderSidebarWithRole = (isAdmin: boolean) => {
  const mockAuthContext = {
    user: { id: '1', email: 'test@example.com' },
    profile: { full_name: 'Test User' },
    isAdmin,
    isDev: false,
    signOut: vi.fn(),
    loading: false,
    rolesLoaded: true,
    roles: isAdmin ? ['admin'] : ['user'],
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <AuthContext.Provider value={mockAuthContext as any}>
            <SidebarReorganized isOpen={true} onToggle={vi.fn()} />
          </AuthContext.Provider>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>,
  );
};

describe('Sidebar Visibility Regression (Intelligence & Trends)', () => {
  it('shows Market Intelligence and Trends for regular users (non-admin)', () => {
    renderSidebarWithRole(false);
    
    // Check for "Inteligência de Mercado"
    const marketIntelLink = screen.getByText(/Inteligência de Mercado/i);
    expect(marketIntelLink).toBeInTheDocument();
    
    // Check for "Tendências"
    const trendsLink = screen.getByText(/Tendências/i);
    expect(trendsLink).toBeInTheDocument();
  });

  it('shows admin-only routes ONLY for admins', () => {
    const { unmount } = renderSidebarWithRole(false);
    expect(screen.queryByText(/Usuários/i)).not.toBeInTheDocument();
    unmount();

    renderSidebarWithRole(true);
    expect(screen.getByText(/Usuários/i)).toBeInTheDocument();
  });
});
