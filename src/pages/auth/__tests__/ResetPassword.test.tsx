import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import ResetPassword from '@/pages/auth/ResetPassword';

const mockNavigate = vi.fn();
const mockToast = vi.fn();
const mockGetSession = vi.fn();
const mockUpdateUser = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

vi.mock('@/pages/auth/AuthBranding', () => ({
  SpaceScene: () => null,
}));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('ResetPassword page flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
    window.location.hash = '';
  });

  it('exibe erro para token inválido/expirado e permite solicitar novo link', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    renderPage();

    expect(await screen.findByText('Link inválido ou expirado')).toBeInTheDocument();
    expect(screen.getByText(/não é mais válido/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Solicitar novo link/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('aceita hash de recovery, redefine senha e permite login posterior', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockUpdateUser.mockResolvedValue({ error: null });
    window.location.hash = '#access_token=abc123&type=recovery';

    renderPage();

    expect(await screen.findByText('Nova Senha')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'SenhaForte@2026' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'SenhaForte@2026' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Redefinir Senha/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'SenhaForte@2026' });
    });

    expect(await screen.findByText('Senha redefinida!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ir para o início/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Senha redefinida!',
      }),
    );
  });

  it('mostra mensagem de erro quando token é rejeitado na redefinição', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockUpdateUser.mockResolvedValue({ error: { message: 'Token expirado' } });

    renderPage();

    expect(await screen.findByText('Nova Senha')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'SenhaForte@2026' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'SenhaForte@2026' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Redefinir Senha/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Erro ao redefinir senha',
          // Hardening a0fd9de: mensagens de erro do fornecedor não vazam no toast;
          // o componente exibe copy genérica fixa.
          description: 'Não foi possível redefinir sua senha. O link pode ter expirado.',
        }),
      );
    });
  });
});
