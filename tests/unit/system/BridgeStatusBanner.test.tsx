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

  // QA: o componente atual de BridgeStatusBanner não diferencia mensagem
  // por isAllowed — sempre mostra "Catálogo externo indisponível." quando
  // unavailable=true (o gate apenas suprime toasts internos no hook). As
  // duas assertions abaixo eram contraditórias (toBeDefined + toBeNull
  // para o mesmo texto) e refletiam uma versão hipotética que nunca foi
  // implementada. Skip até produto decidir se haverá variação real.
  it.skip('should show different message for non-allowed users', () => {
    (useDevGate as any).mockReturnValue({ isAllowed: false });
    (useBridgeStatusBanner as any).mockReturnValue({
      unavailable: true,
      reason: 'Critical Error',
      closeUnavailable: mockCloseUnavailable,
      reload: mockReload,
    });

    render(<BridgeStatusBanner />);

    expect(screen.getByText(/Catálogo externo indisponível/i)).toBeDefined();
    expect(screen.queryByText(/Catálogo externo indisponível/i)).toBeNull();
  });
});
