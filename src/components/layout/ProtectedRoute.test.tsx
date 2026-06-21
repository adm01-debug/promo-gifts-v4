import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  roles: [],
  currentAAL: 'aal1',
  isLoading: false,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    authState.user = null;
    authState.roles = [];
    authState.currentAAL = 'aal1';
    authState.isLoading = false;
  });

  it('redirects unauthenticated users to /auth', () => {
    render(
      <MemoryRouter initialEntries={['/privado']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/privado" element={<div>Área privada</div>} />
          </Route>
          <Route path="/auth" element={<div>Tela Auth</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Tela Auth')).toBeInTheDocument();
  });

  it('renders children for authenticated users', () => {
    authState.user = { id: 'user-1' };

    render(
      <MemoryRouter initialEntries={['/privado']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/privado" element={<div>Área privada</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Área privada')).toBeInTheDocument();
  });
});
