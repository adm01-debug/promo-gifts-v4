import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PersistentBreadcrumbs } from './PersistentBreadcrumbs';

// Mocking useAuth with a proper return value
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ 
    user: { id: 'test-user-id' },
    isDev: false, 
    isAdmin: false 
  }),
}));

// Mocking analytics to verify calls
const mockTrack = vi.fn();
vi.mock('@/hooks/useNavigationAnalytics', () => ({
  useNavigationAnalytics: () => ({
    trackNavigationClick: mockTrack,
  }),
}));

describe('PersistentBreadcrumbs - Teletransporte Tooltip and Icon', () => {
  it('should render the Zap icon (portal) inside the teleport button', () => {
    render(
      <MemoryRouter initialEntries={['/produtos']}>
        <PersistentBreadcrumbs showBackButton />
      </MemoryRouter>
    );

    const teleportBtn = screen.getByTestId('back-teleport-button');
    const icon = teleportBtn.querySelector('svg');
    
    // Check for lucide zap icon class or something identifying
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('text-sky-400');
  });

  it('should have the correct aria-label for accessibility', () => {
    render(
      <MemoryRouter initialEntries={['/produtos']}>
        <PersistentBreadcrumbs showBackButton />
      </MemoryRouter>
    );

    const teleportBtn = screen.getByTestId('back-teleport-button');
    expect(teleportBtn).toHaveAttribute('aria-label', 'Teletransporte — Voltar');
  });
});
