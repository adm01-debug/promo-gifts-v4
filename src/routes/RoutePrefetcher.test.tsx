import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { RoutePrefetcher } from './RoutePrefetcher';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/rota-sem-prefetch' }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

describe('RoutePrefetcher', () => {
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  afterEach(() => {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    }
  });

  it('does not throw when navigator is unavailable', () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: undefined,
    });

    expect(() => render(<RoutePrefetcher />)).not.toThrow();
  });
});
