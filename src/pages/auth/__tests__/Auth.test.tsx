import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Auth from '@/pages/auth/Auth';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// Mocking @/hooks/admin (useIPValidation + useDevGate are both consumed by Auth.tsx)
vi.mock('@/hooks/admin', () => ({
  useIPValidation: () => ({
    validateIPForAuthenticatedUser: vi.fn().mockResolvedValue({ isAllowed: true }),
    logLoginAttempt: vi.fn(),
    fetchCurrentIP: vi.fn().mockResolvedValue('1.2.3.4'),
  }),
  useDevGate: () => ({ isAllowed: false, isDev: false }),
}));

// Mocking useAuth - we need to wrap with AuthProvider or mock the hook
vi.mock('@/contexts/AuthContext', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useAuth: () => ({
      user: null,
      isLoading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    }),
  };
});

const renderAuth = () => {
  return render(
    <HelmetProvider>
      <BrowserRouter>
        <Auth />
      </BrowserRouter>
    </HelmetProvider>,
  );
};

describe('Auth Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form by default', () => {
    renderAuth();
    expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit')).toBeInTheDocument();

    // Ensure the status card and related elements are NOT rendered
    expect(screen.queryByText(/status da infraestrutura/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/banco de dados/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('infrastructure-status-card')).not.toBeInTheDocument();
    expect(screen.queryByText(/status do sistema/i)).not.toBeInTheDocument();
  });

  it('toggles password visibility', () => {
    renderAuth();
    const passwordInput = screen.getByTestId('login-password-input');
    const toggleButton = screen.getByTestId('login-password-toggle');

    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('shows forgot password form when link is clicked', async () => {
    renderAuth();
    const forgotLink = screen.getByTestId('login-forgot-link');

    fireEvent.click(forgotLink);

    // ForgotPasswordForm monta via AnimatePresence (assíncrono) — aguardar.
    expect(await screen.findByText(/Esqueceu sua senha\?/i)).toBeInTheDocument();

    expect(screen.queryByTestId('login-password-input')).not.toBeInTheDocument();
  });
});
