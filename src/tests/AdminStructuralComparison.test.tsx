import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HelmetProvider } from 'react-helmet-async';
import React from 'react';
import AdminConexoesPage from '@/pages/admin/AdminConexoesPage';
import AdminUsuariosPage from '@/pages/admin/AdminUsuariosPage';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    </HelmetProvider>
  </QueryClientProvider>
);


// Mock useSecretsManager to avoid async leaks during tests
vi.mock('@/hooks/useSecretsManager', () => ({
  useSecretsManager: () => ({
    secrets: [],
    isLoading: false,
    listError: null,
    list: vi.fn().mockResolvedValue([]),
    setSecret: vi.fn(),
    rotateSecret: vi.fn(),
    getRotationHistory: vi.fn().mockResolvedValue([]),
    refreshCache: vi.fn(),
  }),
}));

describe('Admin Module Structural Comparison', () => {
  it('Conexoes and Usuarios should share matching container hierarchy', async () => {
    const { container: conexoes } = render(<AdminConexoesPage />, { wrapper });
    const { container: usuarios } = render(<AdminUsuariosPage />, { wrapper });
    
    // Select the standardized inner container (div with max-w inside main)
    const findContainer = (root: HTMLElement) => 
      Array.from(root.querySelectorAll('div')).find(d => d.className.includes('max-w-'));

    const conexoesInner = findContainer(conexoes);
    const usuariosInner = findContainer(usuarios);

    expect(conexoesInner, 'Conexoes missing inner container').not.toBeNull();
    expect(usuariosInner, 'Usuarios missing inner container').not.toBeNull();
  });
});
