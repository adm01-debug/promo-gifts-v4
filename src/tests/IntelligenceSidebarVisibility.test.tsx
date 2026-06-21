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
          <AuthContext.Provider
            value={mockAuthContext as unknown as React.ContextType<typeof AuthContext>}
          >
            <SidebarReorganized isOpen={true} onToggle={vi.fn()} />
          </AuthContext.Provider>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>,
  );
};

describe('Sidebar Visibility Regression (Intelligence & Trends)', () => {
  it('shows Insights group and its items for regular users (non-admin)', () => {
    renderSidebarWithRole(false);

    // Check for "Insights" group by label (uppercase in some contexts, but we use the label from navGroups)
    const insightsLabel = screen.getByText(/INSIGHTS/i);
    expect(insightsLabel).toBeInTheDocument();

    // The button containing the label should be clickable to expand
    const groupButton = insightsLabel.closest('button');
    if (groupButton) {
      fireEvent.click(groupButton);
    }

    // Now check for the items inside by their text
    // Using getAllByText in case there are multiple matches (tooltip + real element)
    expect(screen.getAllByText(/Inteligência de Mercado/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tendências/i).length).toBeGreaterThan(0);
  });

  it('shows admin-only group ONLY for admins', () => {
    const { unmount } = renderSidebarWithRole(false);
    expect(screen.queryByText(/ADMIN/i)).not.toBeInTheDocument();
    unmount();

    renderSidebarWithRole(true);
    expect(screen.getByText(/ADMIN/i)).toBeInTheDocument();
  });
});
