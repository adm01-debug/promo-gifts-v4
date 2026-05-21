import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BridgeStatusBanner } from '@/components/BridgeStatusBanner';
import { useDevGate } from '@/hooks/admin/useDevGate';
import { useBridgeStatusBanner } from '@/hooks/intelligence/useBridgeStatusBanner';
import React from 'react';

// Mock hooks
vi.mock('@/hooks/admin/useDevGate', () => ({
  useDevGate: vi.fn(),
}));

vi.mock('@/hooks/intelligence/useBridgeStatusBanner', () => ({
  useBridgeStatusBanner: vi.fn(),
}));

describe('BridgeStatusBanner', () => {
  const mockCloseUnavailable = vi.fn();
  const mockReload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when not unavailable', () => {
    (useDevGate as any).mockReturnValue({ isAllowed: true });
    (useBridgeStatusBanner as any).mockReturnValue({
      unavailable: false,
      reason: '',
      closeUnavailable: mockCloseUnavailable,
      reload: mockReload,
    });

    const { container } = render(<BridgeStatusBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('should render banner and handle close when unavailable', () => {
    (useDevGate as any).mockReturnValue({ isAllowed: true });
    (useBridgeStatusBanner as any).mockReturnValue({
      unavailable: true,
      reason: 'Critical Error',
      closeUnavailable: mockCloseUnavailable,
      reload: mockReload,
    });

    render(<BridgeStatusBanner />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/Catálogo externo indisponível/i)).toBeDefined();

    const closeButton = screen.getByLabelText(/Fechar aviso/i);
    fireEvent.click(closeButton);

    expect(mockCloseUnavailable).toHaveBeenCalledTimes(1);
  });

  it('não renderiza nada para usuários sem gate (DevOnly bloqueia a mensagem técnica)', () => {
    // Nova convenção: o banner é técnico e fica integralmente atrás de <DevOnly> (gate isAllowed).
    // Usuário sem gate (isAllowed=false) não vê nenhuma mensagem — evita vazar detalhe técnico em prod.
    (useDevGate as any).mockReturnValue({ isAllowed: false, isDev: false });
    (useBridgeStatusBanner as any).mockReturnValue({
      unavailable: true,
      reason: 'Critical Error',
      closeUnavailable: mockCloseUnavailable,
      reload: mockReload,
    });

    const { container } = render(<BridgeStatusBanner />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Catálogo externo indisponível/i)).toBeNull();
  });
});
