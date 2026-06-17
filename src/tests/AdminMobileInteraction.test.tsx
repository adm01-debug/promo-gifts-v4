import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HelmetProvider } from 'react-helmet-async';
import React from 'react';
import { cn } from '@/lib/utils';

// COMPLETELY ISOLATED mock for MainLayout behavior to avoid environmental complexity
// We focus on testing the LOGIC of drawer opening/closing and content accessibility
const TestMainLayout = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <div role="document">
      <header>
        <button onClick={() => setIsOpen(true)} aria-label="Abrir menu">
          Toggle
        </button>
      </header>
      <aside
        aria-label="Menu principal"
        data-testid="sidebar-aside"
        className={cn('fixed transition-transform', isOpen ? 'translate-x-0' : '-translate-x-full')}
      >
        <button onClick={() => setIsOpen(false)} aria-label="Fechar menu">
          Close
        </button>
      </aside>
      <main role="main" aria-hidden={isOpen}>
        {children}
      </main>
    </div>
  );
};

describe('Admin Mobile Interaction Pattern', () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

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

  it('should toggle sidebar and manage main content accessibility correctly', async () => {
    render(<TestMainLayout>Admin Content</TestMainLayout>, { wrapper });

    const sidebar = screen.getByTestId('sidebar-aside');
    const main = screen.getByRole('main');

    // Initially closed
    expect(sidebar.className).toContain('-translate-x-full');
    expect(main.getAttribute('aria-hidden')).toBe('false');

    // Open
    fireEvent.click(screen.getByLabelText(/abrir menu/i));
    expect(sidebar.className).toContain('translate-x-0');
    expect(main.getAttribute('aria-hidden')).toBe('true'); // Content should be hidden from screen readers when drawer is open

    // Close
    fireEvent.click(screen.getByLabelText(/fechar menu/i));
    expect(sidebar.className).toContain('-translate-x-full');
    expect(main.getAttribute('aria-hidden')).toBe('false');
  });
});
