import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Link, Outlet, Route } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';

vi.mock('@/lib/lazyWithRetry', () => ({
  lazyWithRetry: (_loader: () => Promise<unknown>) => {
    const Mock = () => (
      <div data-testid="lazy-shell">
        <Outlet />
      </div>
    );
    return Mock;
  },
}));

vi.mock('@/components/layout/ProtectedRoute', () => ({
  ProtectedRoute: () => <Outlet />,
}));

vi.mock('./public-routes', () => ({
  publicRoutes: <Route path="/auth" element={<div>Auth</div>} />,
}));

vi.mock('./product-routes', () => ({ productRoutes: null }));
vi.mock('./quote-routes', () => ({ quoteRoutes: null }));
vi.mock('./admin-routes', () => ({ adminRoutes: null }));
vi.mock('./tools-routes', () => ({ toolsRoutes: null }));

vi.mock('./client-routes', () => ({
  homeAndClientRoutes: (
    <>
      <Route path="/" element={<Link to="/clientes">Ir clientes</Link>} />
      <Route path="/clientes" element={<div>Clientes</div>} />
    </>
  ),
  notFoundRoute: <Route path="*" element={<div data-testid="not-found">404</div>} />,
}));

describe('AppRoutes navigation', () => {
  it('navigates across main routes without render errors', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText('Ir clientes')).toBeInTheDocument();
    await user.click(screen.getByText('Ir clientes'));
    expect(screen.getByText('Clientes')).toBeInTheDocument();
  });

  it('renders not found fallback for unknown routes', () => {
    render(
      <MemoryRouter initialEntries={['/rota-inexistente']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('not-found')).toBeInTheDocument();
  });
});
