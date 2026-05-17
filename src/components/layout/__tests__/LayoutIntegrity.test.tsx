import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Header } from '../Header';
import { SidebarReorganized } from '../SidebarReorganized';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock simple hooks that might cause issues in a basic render test
vi.mock('@/hooks/useScroll', () => ({
  useIsScrolled: () => false,
}));

vi.mock('@/hooks/useCurrentSection', () => ({
  useCurrentSection: () => 'Dashboard',
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <OnboardingProvider>
            {children}
          </OnboardingProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

describe('Layout Integrity Tests', () => {
  it('Header should render without crashing', () => {
    const { getByTestId } = render(
      <Header onMenuToggle={() => {}} searchQuery="" onSearchChange={() => {}} />,
      { wrapper }
    );
    expect(getByTestId('app-header')).toBeDefined();
  });

  it('SidebarReorganized should render without crashing', () => {
    const { getByLabelText } = render(
      <SidebarReorganized isOpen={true} onToggle={() => {}} />,
      { wrapper }
    );
    expect(getByLabelText('Menu principal')).toBeDefined();
  });

  it('Components should be memoized properly', async () => {
    const { Header } = await import('../Header');
    const { SidebarReorganized } = await import('../SidebarReorganized');
    
    expect(typeof Header).toBe('object'); 
    expect(typeof SidebarReorganized).toBe('object');
  });
});
