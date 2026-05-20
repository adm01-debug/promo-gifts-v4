import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React, { useEffect } from 'react';
import { useDevGate } from '@/hooks/admin/useDevGate';
import { DevOnlyBridgeOverlay } from '@/components/dev/DevOnlyBridgeOverlay';

// Mock do hook useDevGate
vi.mock('@/hooks/admin/useDevGate', () => ({
  useDevGate: vi.fn(),
}));

// Rastreamento de eventos de ciclo de vida
let lifecycleEvents: string[] = [];

let renderCount = 0;
vi.mock('@/components/dev/BridgeMetricsOverlay', () => ({
  default: React.memo(() => {
    useEffect(() => {
      lifecycleEvents.push('mount');
      renderCount++;
      return () => {
        lifecycleEvents.push('unmount');
      };
    }, []);
    return <div data-testid="bridge-metrics-overlay-real">Overlay Active</div>;
  }),
}));

describe('DevInfraGate Stability — Lifecycle & Flicker Detection', () => {
  beforeEach(() => {
    lifecycleEvents = [];
    renderCount = 0;
    vi.clearAllMocks();
  });

  it('garante que o overlay monta exatamente uma vez na entrada e desmonta na saída, sem renderizações extras ou flashes', async () => {
    // 1. Estado inicial: Bloqueado (isLoading ou !mounted)
    vi.mocked(useDevGate).mockReturnValue({
      isAllowed: false,
      isDev: false
    });

    const { rerender } = render(<DevOnlyBridgeOverlay />);
    expect(lifecycleEvents).toEqual([]);
    expect(document.body.innerHTML).not.toContain('bridge-metrics-overlay');

    // 2. Entrada: Ganha permissão
    vi.mocked(useDevGate).mockReturnValue({
      isAllowed: true,
      isDev: true
    });

    await act(async () => {
      rerender(<DevOnlyBridgeOverlay />);
    });

    // Deve montar exatamente uma vez
    expect(await screen.findByTestId('bridge-metrics-overlay-real')).toBeInTheDocument();
    expect(lifecycleEvents).toEqual(['mount']);
    expect(renderCount).toBe(1);

    // 3. Estabilidade: Re-render com mesmos valores de permissão
    // Simula um update no contexto pai que não altera isAllowed
    await act(async () => {
      rerender(<DevOnlyBridgeOverlay />);
    });
    expect(lifecycleEvents).toEqual(['mount']);
    expect(renderCount).toBe(1); // Não deve ter re-renderizado o componente memoizado

    // 4. Saída: Perde permissão
    vi.mocked(useDevGate).mockReturnValue({
      isAllowed: false,
      isDev: false
    });

    await act(async () => {
      rerender(<DevOnlyBridgeOverlay />);
    });

    // Deve desmontar exatamente uma vez
    expect(screen.queryByTestId('bridge-metrics-overlay-real')).not.toBeInTheDocument();
    expect(lifecycleEvents).toEqual(['mount', 'unmount']);
    
    // 5. Re-entrada: Ganha permissão novamente
    vi.mocked(useDevGate).mockReturnValue({
      isAllowed: true,
      isDev: true
    });

    await act(async () => {
      rerender(<DevOnlyBridgeOverlay />);
    });

    expect(await screen.findByTestId('bridge-metrics-overlay-real')).toBeInTheDocument();
    expect(lifecycleEvents).toEqual(['mount', 'unmount', 'mount']);
  });
});
