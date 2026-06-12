import { render, screen, fireEvent } from '@testing-library/react';
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
  it('shows Insights group and its items for regular users (non-admin)', async () => {
    renderSidebarWithRole(false);
    
    // Check for "Insights" group
    const insightsGroup = screen.getByText(/Insights/i);
    expect(insightsGroup).toBeInTheDocument();

    // Click to expand the group if it's not default open
    fireEvent.click(insightsGroup);

    // Now check for the items inside
    expect(await screen.findByText(/Inteligência de Mercado/i)).toBeInTheDocument();
    expect(await screen.findByText(/Tendências/i)).toBeInTheDocument();
  });

  it('shows admin-only group ONLY for admins', () => {
    const { unmount } = renderSidebarWithRole(false);
    expect(screen.queryByText(/Admin/i)).not.toBeInTheDocument();
    unmount();

    renderSidebarWithRole(true);
    expect(screen.getByText(/Admin/i)).toBeInTheDocument();
  });
});
