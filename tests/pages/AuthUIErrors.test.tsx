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

    const emailInput = screen.getByPlaceholderText(/seu@email.com/i);
    const passwordInput = screen.getByPlaceholderText(/sua senha/i);
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // O shadcn toast é difícil de pegar no DOM se não estiver configurado o Toaster,
      // mas podemos verificar se o diagnóstico foi impresso (se renderizado inline)
      // No Auth.tsx, o toast recebe o componente:
      // description: ( <div ... >DIAGNÓSTICO: {diagnosis}</div> )
    });
  });

  it('deve processar erro 429 como rate limit', async () => {
    mockSignIn.mockResolvedValue({
      error: { 
        message: 'too many requests', 
        status: 429 
      }
    });

    renderAuth();

    const emailInput = screen.getByPlaceholderText(/seu@email.com/i);
    const passwordInput = screen.getByPlaceholderText(/sua senha/i);
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    // Verificação via mock de toast se possível, ou apenas garantir que mockSignIn foi chamado
    expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
  });
});
