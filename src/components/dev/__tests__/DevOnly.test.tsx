import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DevOnly } from '../DevOnly';

// DevOnly imports useDevGate from the direct subpath, not the barrel.
// Use vi.hoisted to share a single mock fn across both paths.
const mockUseDevGate = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/admin', () => ({
  useDevGate: mockUseDevGate,
}));

vi.mock('@/hooks/admin/useDevGate', () => ({
  useDevGate: mockUseDevGate,
}));

describe('<DevOnly>', () => {
  beforeEach(() => mockUseDevGate.mockReset());

  it('renderiza children quando isAllowed=true', () => {
    mockUseDevGate.mockReturnValue({ isAllowed: true, isDev: false });
    render(
      <DevOnly>
        <span>internal</span>
      </DevOnly>,
    );
    expect(screen.getByText('internal')).toBeInTheDocument();
  });

  it('renderiza fallback quando bloqueado', () => {
    mockUseDevGate.mockReturnValue({ isAllowed: false, isDev: false });
    render(
      <DevOnly fallback={<span>public</span>}>
        <span>internal</span>
      </DevOnly>,
    );
    expect(screen.queryByText('internal')).not.toBeInTheDocument();
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  it('strict exige isDev real (ignora override)', () => {
    mockUseDevGate.mockReturnValue({ isAllowed: true, isDev: false });
    render(
      <DevOnly strict>
        <span>internal</span>
      </DevOnly>,
    );
    expect(screen.queryByText('internal')).not.toBeInTheDocument();
  });

  it('strict permite quando isDev=true', () => {
    mockUseDevGate.mockReturnValue({ isAllowed: true, isDev: true });
    render(
      <DevOnly strict>
        <span>internal</span>
      </DevOnly>,
    );
    expect(screen.getByText('internal')).toBeInTheDocument();
  });
});
