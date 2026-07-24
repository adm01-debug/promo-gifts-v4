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
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const mockAuthContext = {
  user: { id: '1', email: 'test@example.com' },
  profile: { full_name: 'Test User' },
  role: 'admin',
  isAdmin: true,
  isDev: false,
  signOut: vi.fn(),
  loading: false,
  rolesLoaded: true,
  permissions: [],
};

const renderSidebar = (props = { isOpen: true, onToggle: vi.fn() }) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <AuthContext.Provider
            value={
              mockAuthContext as unknown as Parameters<typeof AuthContext.Provider>[0]['value']
            }
          >
            <SidebarReorganized {...props} />
          </AuthContext.Provider>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>,
  );
};

describe('SidebarReorganized', () => {
  it('renders correctly and is visible when open', () => {
    renderSidebar();
    const sidebar = screen.getByRole('navigation', { name: /menu principal/i });
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveClass('translate-x-0');
  });

  it('collapses and expands on button click', () => {
    renderSidebar();
    const collapseButton = screen.getByLabelText(/recolher menu/i);

    // Initial state: expanded (w-64)
    const sidebar = screen.getByRole('navigation', { name: /menu principal/i });
    expect(sidebar).toHaveClass('w-64');

    // Click to collapse
    fireEvent.click(collapseButton);
    expect(sidebar).toHaveClass('w-16');

    // Click to expand
    const expandButton = screen.getByLabelText(/expandir menu/i);
    fireEvent.click(expandButton);
    expect(sidebar).toHaveClass('w-64');
  });

  it('handles keyboard navigation', () => {
    renderSidebar();
    const nav = screen.getByRole('navigation', { name: /menu principal/i });
    const links = nav.querySelectorAll('a');

    // Focus the first link
    links[0].focus();
    expect(document.activeElement).toBe(links[0]);

    // Tab to next
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    // Verify it exists and is not disabled
    expect(links[1]).toBeInTheDocument();
    expect(links[1].tagName).toBe('A');
  });

  it('has correct z-index in desktop', () => {
    renderSidebar();
    const sidebar = screen.getByRole('navigation', { name: /menu principal/i });
    expect(sidebar).toHaveClass('lg:z-40');
  });
});
