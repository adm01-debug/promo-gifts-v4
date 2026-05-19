import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import Auth from '@/pages/Auth';
import { AuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock hooks
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(({ title, description }) => {
      // Manual trigger for visibility in testing-library
      // In real app, shadcn toast renders in a portal
    }),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('Auth Page UI Diagnostics (Vitest)', () => {
  const mockSignIn = vi.fn();
  const mockSignOut = vi.fn();

  const authValue = {
    user: null,
    session: null,
    profile: null,
    isLoading: false,
    roles: [],
    role: null,
    isDev: false,
    isSupervisor: false,
    isAgente: false,
    isSupervisorOrAbove: false,
    isAdmin: false,
    isManager: false,
    isSeller: false,
    canManage: false,
    isAuthenticated: false,
    currentAAL: null,
    nextAAL: null,
    hasMFA: false,
    mfaRequired: false,
    rolesLoaded: true,
    refreshAAL: vi.fn(),
    signIn: mockSignIn,
    signOut: mockSignOut,
    refreshProfile: vi.fn(),
    refreshSession: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderAuth = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authValue as any}>
          <MemoryRouter>
            <Auth />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
  };

  it('deve processar erro 400 como falha de credenciais', async () => {
    mockSignIn.mockResolvedValue({
      error: { 
        message: 'Invalid login credentials', 
        status: 400 
      }
    });

    renderAuth();

    // Fill form (simplified as we are testing the handler logic)
    // Actually, we can just trigger the handler if we had a reference, 
    // but let's do it via UI to be sure.
    
    // Auth.tsx has labels and inputs
  });
});
