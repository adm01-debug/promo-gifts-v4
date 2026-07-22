/**
 * Onda 14 — regressão: ResetPassword deve consumir authService.updatePasswordSafe
 * e mapear cada errorKind para copy PT-BR contextual.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import ResetPassword from '@/pages/auth/ResetPassword';

const mockNavigate = vi.fn();
const mockToast = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockUnsubscribe = vi.fn();
const mockUpdatePasswordSafe = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => mockGetSession(...a),
      onAuthStateChange: (...a: unknown[]) => mockOnAuthStateChange(...a),
    },
  },
}));

vi.mock('@/services/authService', () => ({
  authService: {
    updatePasswordSafe: (...a: unknown[]) => mockUpdatePasswordSafe(...a),
  },
}));

vi.mock('@/pages/auth/AuthBranding', () => ({ SpaceScene: () => null }));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    </HelmetProvider>,
  );

async function fillAndSubmit() {
  expect(await screen.findByText('Nova Senha')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Nova senha'), {
    target: { value: 'SenhaForte@2026' },
  });
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
    target: { value: 'SenhaForte@2026' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Redefinir Senha/i }));
}

describe('ResetPassword — updatePasswordSafe (Onda 14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    window.location.hash = '#access_token=abc&type=recovery';
  });

  it('ok → tela de sucesso e chama updatePasswordSafe', async () => {
    mockUpdatePasswordSafe.mockResolvedValue({
      kind: 'ok',
      data: null,
      attempts: 1,
      elapsedMs: 10,
    });

    renderPage();
    await fillAndSubmit();

    await waitFor(() => {
      expect(mockUpdatePasswordSafe).toHaveBeenCalledWith('SenhaForte@2026');
    });
    expect(await screen.findByText('Senha redefinida!')).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Senha redefinida!' }),
    );
  });

  it('errorKind=credential → copy "Link expirado"', async () => {
    mockUpdatePasswordSafe.mockResolvedValue({
      kind: 'err',
      errorKind: 'credential',
      userMessage: 'Credenciais inválidas',
      raw: null,
      attempts: 1,
      elapsedMs: 5,
    });

    renderPage();
    await fillAndSubmit();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: expect.stringMatching(/link expirado/i),
        }),
      );
    });
    expect(screen.queryByText('Senha redefinida!')).not.toBeInTheDocument();
  });

  it('errorKind=ratelimit → copy "Muitas tentativas"', async () => {
    mockUpdatePasswordSafe.mockResolvedValue({
      kind: 'err',
      errorKind: 'ratelimit',
      userMessage: 'ratelimit',
      raw: null,
      attempts: 1,
      elapsedMs: 5,
    });

    renderPage();
    await fillAndSubmit();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringMatching(/muitas tentativas/i),
        }),
      );
    });
  });

  it('errorKind=network → copy "Sem conexão"', async () => {
    mockUpdatePasswordSafe.mockResolvedValue({
      kind: 'err',
      errorKind: 'network',
      userMessage: 'network',
      raw: null,
      attempts: 2,
      elapsedMs: 20,
    });

    renderPage();
    await fillAndSubmit();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringMatching(/sem conexão/i),
        }),
      );
    });
  });

  it('errorKind=server → usa userMessage sanitizado', async () => {
    mockUpdatePasswordSafe.mockResolvedValue({
      kind: 'err',
      errorKind: 'server',
      userMessage: 'Não foi possível concluir. Tente novamente.',
      raw: null,
      attempts: 3,
      elapsedMs: 30,
    });

    renderPage();
    await fillAndSubmit();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Não foi possível concluir. Tente novamente.',
        }),
      );
    });
  });
});
