import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderWithRouter(ui: React.ReactElement, initialRoute = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/auth" element={<div>Login Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/protected" element={ui} />
      </Routes>
    </MemoryRouter>
  );
}

function authMock(overrides: Record<string, unknown> = {}) {
  return {
    user: null,
    isLoading: false,
    isDev: false,
    isSupervisor: false,
    isSupervisorOrAbove: false,
    isAgente: false,
    ...overrides,
  };
}

describe('ProtectedRoute', () => {
  it('shows loader while auth is loading', () => {
    mockUseAuth.mockReturnValue(authMock({ isLoading: true }));
    renderWithRouter(
      <ProtectedRoute><div>Secret</div></ProtectedRoute>
    );
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('redirects to /login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue(authMock());
    renderWithRouter(
      <ProtectedRoute><div>Secret</div></ProtectedRoute>
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue(authMock({ user: { id: '123' } }));
    renderWithRouter(
      <ProtectedRoute><div>Secret Content</div></ProtectedRoute>
    );
    expect(screen.getByText('Secret Content')).toBeInTheDocument();
  });

  it('blocks with Acesso Restrito when requireAdmin=true and user is not supervisor', () => {
    // Componente atual mostra EmptyState 'Acesso Restrito' em vez de Navigate.
    mockUseAuth.mockReturnValue(authMock({ user: { id: '123' }, roles: [] }));
    renderWithRouter(
      <ProtectedRoute requireAdmin><div>Admin Only</div></ProtectedRoute>
    );
    expect(screen.getByText(/Acesso Restrito/i)).toBeInTheDocument();
    expect(screen.queryByText('Admin Only')).not.toBeInTheDocument();
  });

  it('renders children when requireAdmin=true and user is supervisor', () => {
    mockUseAuth.mockReturnValue(
      authMock({ user: { id: '123' }, roles: ['supervisor'], isSupervisor: true, isSupervisorOrAbove: true })
    );
    renderWithRouter(
      <ProtectedRoute requireAdmin><div>Admin Content</div></ProtectedRoute>
    );
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('blocks with Acesso Restrito when requiredRole="dev" and user is only supervisor', () => {
    mockUseAuth.mockReturnValue(
      authMock({ user: { id: '123' }, roles: ['supervisor'], isSupervisor: true, isSupervisorOrAbove: true })
    );
    renderWithRouter(
      <ProtectedRoute requiredRole="dev"><div>Dev Only</div></ProtectedRoute>
    );
    expect(screen.getByText(/Acesso Restrito/i)).toBeInTheDocument();
  });

  it('renders when requiredRole="dev" and user is dev', () => {
    mockUseAuth.mockReturnValue(
      authMock({ user: { id: '123' }, roles: ['dev'], isDev: true, isSupervisorOrAbove: true })
    );
    renderWithRouter(
      <ProtectedRoute requiredRole="dev"><div>Dev Content</div></ProtectedRoute>
    );
    expect(screen.getByText('Dev Content')).toBeInTheDocument();
  });
});
