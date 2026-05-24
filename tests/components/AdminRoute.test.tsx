import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminRoute } from '@/components/layout/AdminRoute';

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderWithRouter(ui: React.ReactElement, initialRoute = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/auth" element={<div>Login Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/admin" element={ui} />
      </Routes>
    </MemoryRouter>
  );
}

const baseAuth = {
  currentAAL: 'aal2' as const,
  hasMFA: true,
  mfaRequired: false,
  refreshAAL: vi.fn(),
};

describe('AdminRoute', () => {
  it('shows loader while auth is loading', () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, user: null, canManage: false, isLoading: true });
    renderWithRouter(<AdminRoute><div>Admin Panel</div></AdminRoute>);
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('redirects to /login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, user: null, canManage: false, isLoading: false });
    renderWithRouter(<AdminRoute><div>Admin Panel</div></AdminRoute>);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('blocks with Área Administrativa EmptyState when user cannot manage (vendedor)', () => {
    // AdminRoute atual mostra EmptyState 'Área Administrativa' em vez de Navigate.
    mockUseAuth.mockReturnValue({ ...baseAuth, user: { id: '123' }, canManage: false, isLoading: false });
    renderWithRouter(<AdminRoute><div>Admin Panel</div></AdminRoute>);
    expect(screen.getByText(/Área Administrativa/i)).toBeInTheDocument();
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
  });

  it('renders children when admin has MFA and AAL2', () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, user: { id: '123' }, canManage: true, isLoading: false });
    renderWithRouter(<AdminRoute><div>Admin Panel</div></AdminRoute>);
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
  });

  it('renders children when manager has MFA and AAL2', () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, user: { id: '456' }, canManage: true, isLoading: false });
    renderWithRouter(<AdminRoute><div>Manager Content</div></AdminRoute>);
    expect(screen.getByText('Manager Content')).toBeInTheDocument();
  });

  it('blocks admin without MFA (shows enrollment gate)', () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, user: { id: '123' }, canManage: true, isLoading: false, hasMFA: false });
    renderWithRouter(<AdminRoute><div>Admin Panel</div></AdminRoute>);
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
  });

  it('blocks admin in AAL1 even with MFA enrolled (challenge gate)', () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, user: { id: '123' }, canManage: true, isLoading: false, currentAAL: 'aal1', mfaRequired: true });
    renderWithRouter(<AdminRoute><div>Admin Panel</div></AdminRoute>);
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
  });
});
