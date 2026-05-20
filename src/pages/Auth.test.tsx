import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Auth from '@/pages/auth/Auth';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { HelmetProvider } from 'react-helmet-async';

// framer-motion: AnimatePresence "mode=wait" não resolve a saída em jsdom, então
// o ramo entrante (forgot password) nunca monta. Renderiza tudo síncrono.
vi.mock('framer-motion', () => {
  const ANIM_PROP = /^(initial|animate|exit|transition|whileHover|whileTap|variants|layout)/;
  const passthrough = (tag: string) =>
    React.forwardRef<unknown, Record<string, unknown>>(function MotionMock(props, ref) {
      const { children, ...rest } = props;
      const clean: Record<string, unknown> = {};
      for (const k of Object.keys(rest)) {
        if (!ANIM_PROP.test(k)) clean[k] = rest[k];
      }
      return React.createElement(tag, { ref, ...clean }, children as React.ReactNode);
    });
  // Cacheia por tag para identidade de componente estável (evita remontagem da
  // subárvore a cada render, que invalidaria nós capturados nos testes).
  const cache = new Map<string, React.ComponentType<Record<string, unknown>>>();
  return {
    motion: new Proxy({} as Record<string, React.ComponentType<Record<string, unknown>>>, {
      get: (_target, prop: string) => {
        if (!cache.has(prop)) cache.set(prop, passthrough(prop));
        return cache.get(prop);
      },
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

// Mocking useIPValidation + useDevGate (ambos exportados via @/hooks/admin)
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
        <Toaster />
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

  it('shows forgot password form when link is clicked', () => {
    renderAuth();
    const forgotLink = screen.getByTestId('login-forgot-link');

    fireEvent.click(forgotLink);

    // Check for forgot password form elements
    expect(screen.getByText(/Esqueceu sua senha\?/i)).toBeInTheDocument();

    expect(screen.queryByTestId('login-password-input')).not.toBeInTheDocument();
  });
});
