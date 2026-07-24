import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { PersistentBreadcrumbs } from './PersistentBreadcrumbs';

// Mocks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
    useLocation: vi.fn(),
  };
});

const mockTrack = vi.fn();
vi.mock('@/hooks/useNavigationAnalytics', () => ({
  useNavigationAnalytics: () => ({
    trackNavigationClick: mockTrack,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
    isDev: false,
    isAdmin: false,
  }),
}));

describe('PersistentBreadcrumbs - Teletransporte Logic', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);
  });

  it('should render the Zap icon (portal) and correct aria-label', () => {
    (useLocation as ReturnType<typeof vi.fn>).mockReturnValue({ pathname: '/produtos' });
    render(
      <MemoryRouter>
        <PersistentBreadcrumbs showBackButton />
      </MemoryRouter>,
    );

    const teleportBtn = screen.getByTestId('back-teleport-button');
    const icon = teleportBtn.querySelector('svg');

    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('text-sky-400');
    expect(teleportBtn).toHaveAttribute('aria-label', 'Teletransporte — Voltar');
  });

  it('should call navigate(-1) and track analytics when history is long enough', () => {
    (useLocation as ReturnType<typeof vi.fn>).mockReturnValue({ pathname: '/favoritos' });

    // Simula history.length > 2
    Object.defineProperty(window, 'history', {
      value: { length: 5 },
      writable: true,
    });

    render(
      <MemoryRouter>
        <PersistentBreadcrumbs showBackButton />
      </MemoryRouter>,
    );

    const teleportBtn = screen.getByTestId('back-teleport-button');
    fireEvent.click(teleportBtn);

    expect(mockTrack).toHaveBeenCalledWith('Teletransporte', 'previous_page');
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('should fallback to home when history is shallow', () => {
    (useLocation as ReturnType<typeof vi.fn>).mockReturnValue({ pathname: '/produtos' });

    // Simula history.length <= 2 (entrada direta)
    Object.defineProperty(window, 'history', {
      value: { length: 2 },
      writable: true,
    });

    render(
      <MemoryRouter>
        <PersistentBreadcrumbs showBackButton />
      </MemoryRouter>,
    );

    const teleportBtn = screen.getByTestId('back-teleport-button');
    fireEvent.click(teleportBtn);

    expect(mockTrack).toHaveBeenCalledWith('Teletransporte', '/');
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should not show back button on home page', () => {
    (useLocation as ReturnType<typeof vi.fn>).mockReturnValue({ pathname: '/' });

    render(
      <MemoryRouter>
        <PersistentBreadcrumbs showBackButton />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('back-teleport-button')).not.toBeInTheDocument();
  });
});
