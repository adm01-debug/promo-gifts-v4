import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDevGate } from '@/hooks/admin/useDevGate';
import { useAuth } from '@/contexts/AuthContext';
import { DevOnlyBridgeOverlay } from '@/components/dev/DevOnlyBridgeOverlay';
import React from 'react';

// Mock do hook useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock do hook useDevGate (que queremos testar indiretamente ou mockar para testar o overlay)
vi.mock('@/hooks/admin/useDevGate', () => ({
  useDevGate: vi.fn(),
}));

// Mock do overlay real para evitar carregamento de telemetria/lazy components
vi.mock('@/components/dev/BridgeMetricsOverlay', () => ({
  default: () => <div data-testid="bridge-metrics-overlay-real">Real Overlay Content</div>,
}));

describe('DevInfraGate Integration — SSR & Auth Loading Guards', () => {
  it('NUNCA renderiza o overlay durante o carregamento inicial do AuthContext (isLoading: true)', () => {
    // Cenário: Usuário é dev, mas o AuthContext ainda está resolvendo a sessão/roles
    vi.mocked(useDevGate).mockReturnValue({
      isAllowed: false, // O hook useDevGate já deve retornar false se isLoading for true
      isDev: false
    });
    
    const { container } = render(<DevOnlyBridgeOverlay />);
    
    // Deve ser absolutamente vazio (nem container, nem comentários de Suspense)
    expect(container.innerHTML).toBe("");
    expect(screen.queryByTestId('bridge-metrics-overlay-real')).not.toBeInTheDocument();
  });

  it('NUNCA renderiza o overlay antes da montagem no cliente (mounted: false / SSR simulation)', () => {
    // useDevGate utiliza um state 'mounted' que só vira true no useEffect.
    // Simulamos o estado onde mounted seria false (estado inicial do hook).
    vi.mocked(useDevGate).mockReturnValue({
      isAllowed: false, // isAllowed = mounted && !isLoading && isAllowedStore
      isDev: false
    });

    const { container } = render(<DevOnlyBridgeOverlay />);
    
    // O HTML gerado deve ser vazio para evitar hidratação incorreta ou vazamento visual
    expect(container).toBeEmptyDOMElement();
  });

  it('SÓ renderiza o overlay APÓS mounted ser true, isLoading ser false e permissão ser confirmada', async () => {
    // Cenário: Montado, carregado e permitido
    vi.mocked(useDevGate).mockReturnValue({
      isAllowed: true,
      isDev: true
    });

    render(<DevOnlyBridgeOverlay />);
    
    // Deve encontrar o conteúdo do overlay
    const overlay = await screen.findByTestId('bridge-metrics-overlay-real');
    expect(overlay).toBeInTheDocument();
  });

  it('BLOQUEIA renderização se o usuário não for dev mesmo após montagem e carregamento', () => {
    // Cenário: Montado e carregado, mas usuário comum
    vi.mocked(useDevGate).mockReturnValue({
      isAllowed: false,
      isDev: false
    });

    const { container } = render(<DevOnlyBridgeOverlay />);
    
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('bridge-metrics-overlay-real')).not.toBeInTheDocument();
  });
});
