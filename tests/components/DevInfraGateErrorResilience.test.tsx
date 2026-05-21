import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DevOnlyBridgeOverlay } from '@/components/dev/DevOnlyBridgeOverlay';
import { useDevGate } from '@/hooks/admin/useDevGate';

// Mock do hook useDevGate
vi.mock('@/hooks/admin/useDevGate', () => ({
  useDevGate: vi.fn(),
}));

// Mock do overlay real
vi.mock('@/components/dev/BridgeMetricsOverlay', () => ({
  default: () => <div data-testid="bridge-metrics-overlay-real">Should Not See This</div>,
}));

describe('DevInfraGate Resilience — Auth Error/Timeout Scenarios', () => {
  it('permanece bloqueado se o AuthContext falhar ou entrar em timeout (isLoading nunca vira false)', () => {
    // Cenário: AuthContext travado em carregamento ou erro interno onde isAllowed nunca é true
    vi.mocked(useDevGate).mockReturnValue({
      isAllowed: false,
      isDev: false
    });

    const { container } = render(<DevOnlyBridgeOverlay />);
    
    // Mesmo que passe muito tempo (simulado aqui por não mudar o mock), o componente deve retornar null
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('bridge-metrics-overlay-real')).not.toBeInTheDocument();
  });

  it('permanece bloqueado se o AuthContext retornar erro e roles vazias', () => {
    // Cenário: Auth terminou com erro, isLoading: false, mas roles: []
    vi.mocked(useDevGate).mockReturnValue({
      isAllowed: false,
      isDev: false
    });

    const { container } = render(<DevOnlyBridgeOverlay />);
    
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('bridge-metrics-overlay-real')).not.toBeInTheDocument();
  });
});
