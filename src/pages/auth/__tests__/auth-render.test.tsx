/**
 * Render-test da tela de login com mocks pesados.
 *
 * Auth.tsx depende de AuthContext, Supabase, react-router, IP validation,
 * dev gate, branding panel, SEO e social login. Mockamos tudo isso para
 * isolar o teste no que importa: o copy renderizado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---- Mocks -----------------------------------------------------------------
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('@/hooks/admin/useIPValidation', () => ({
  useIPValidation: () => ({
    validateIPForAuthenticatedUser: vi.fn(),
    logLoginAttempt: vi.fn(),
  }),
}));

vi.mock('@/hooks/admin/useDevGate', () => ({
  useDevGate: () => ({ isAllowed: false }),
}));

vi.mock('@/hooks/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/integrations/supabase/lazy-client', () => ({
  getSupabaseClient: vi.fn(async () => ({
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  })),
}));

vi.mock('@/lib/env/supabase-placeholder', () => ({
  isSupabaseLighthousePlaceholder: () => true,
}));

vi.mock('@/components/auth/SocialLoginButtons', () => ({
  SocialLoginButtons: () => <div data-testid="social-login-stub" />,
}));

vi.mock('@/components/auth/ForgotPasswordForm', () => ({
  ForgotPasswordForm: () => <div data-testid="forgot-stub" />,
}));

vi.mock('@/components/seo/PageSEO', () => ({
  PageSEO: () => null,
}));

vi.mock('@/pages/auth/AuthBranding', () => ({
  AuthBrandingPanel: () => <div data-testid="branding-stub" />,
  SpaceScene: () => <div data-testid="space-stub" />,
}));

vi.mock('@/components/layout/AppLogo', () => ({
  AppLogo: () => <div data-testid="logo-stub" />,
}));

// ---- Suite -----------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
});

describe('Auth page — render smoke', () => {
  it('renderiza a frase de copy na tela de login', async () => {
    const { default: Auth } = await import('../Auth');

    render(
      <MemoryRouter initialEntries={['/auth']}>
        <Auth />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('Continue sua jornada rumo ao sucesso.'),
    ).toBeInTheDocument();
  });
});
