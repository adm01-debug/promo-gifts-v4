import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PersistentBreadcrumbs } from './PersistentBreadcrumbs';

const authState = vi.hoisted(() => ({ isDev: false, isAdmin: false }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

describe('PersistentBreadcrumbs', () => {
  beforeEach(() => {
    authState.isDev = false;
    authState.isAdmin = false;
  });

  it('renders base breadcrumbs for protected route', () => {
    render(
      <MemoryRouter initialEntries={['/orcamentos']}>
        <PersistentBreadcrumbs />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.getByText('Orçamentos')).toBeInTheDocument();
  });

  it('keeps dynamic id segment readable and does not break render', () => {
    render(
      <MemoryRouter initialEntries={['/colecoes/12345']}>
        <PersistentBreadcrumbs />
      </MemoryRouter>,
    );

    expect(screen.getByText('Coleções')).toBeInTheDocument();
    expect(screen.getByText('#12345...')).toBeInTheDocument();
  });
});
