import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { render, screen, act } from '@testing-library/react';
import { DevOnlyBridgeOverlay } from '@/components/dev/DevOnlyBridgeOverlay';
import { useDevGate } from '@/hooks/admin/useDevGate';

// Mock dos hooks
vi.mock('@/hooks/admin/useDevGate', () => ({
  useDevGate: vi.fn(),
}));

// Mock do overlay real
vi.mock('@/components/dev/BridgeMetricsOverlay', () => ({
  default: () => <div data-testid="bridge-metrics-overlay-real">Real Overlay</div>,
}));

describe('DevInfraGate SSR & Hydration Integration', () => {
  it('garante que o overlay é omitido no SSR (mesmo com isLoading true) e só aparece após hidratação completa no cliente', async () => {
    // --- FASE 1: SSR (Servidor - Simula estado inicial de carregamento) ---
    // No servidor, isAllowed é sempre false por segurança
    vi.mocked(useDevGate).mockReturnValue({
      isAllowed: false,
      isDev: false
    });

    const ssrHtml = renderToString(<DevOnlyBridgeOverlay />);
    
    // O HTML gerado pelo servidor DEVE ser absolutamente vazio
    // Não deve conter nem wrappers de Suspense (comentários <!--$-->) nem qualquer rastro do overlay
    expect(ssrHtml).toBe('');
    expect(ssrHtml).not.toContain('<!--');
    expect(ssrHtml).not.toContain('bridge-metrics-overlay');

    // --- FASE 2: Hidratação simulada (Cliente - Fase de Carregamento) ---
    // Simula o momento em que o código roda no cliente, mas o AuthContext ainda está isLoading: true
    // e o componente ainda não disparou o useEffect de montagem.
    vi.mocked(useDevGate).mockReturnValue({
      isAllowed: false,
      isDev: false
    });

    const { rerender } = render(<DevOnlyBridgeOverlay />);
    
    // Garante que o HTML renderizado no cliente durante o carregamento 
    // é absolutamente vazio, sem placeholders ou wrappers
    expect(document.body.innerHTML).not.toContain('bridge-metrics-overlay');
    expect(screen.queryByTestId('bridge-metrics-overlay-real')).not.toBeInTheDocument();

    // --- FASE 3: Cliente (Finalizado e Autorizado) ---
    // Simula a resolução do Auth (isLoading=false) e permissão concedida
    vi.mocked(useDevGate).mockReturnValue({
      isAllowed: true,
      isDev: true
    });

    await act(async () => {
      rerender(<DevOnlyBridgeOverlay />);
    });

    // O overlay deve aparecer agora
    expect(await screen.findByTestId('bridge-metrics-overlay-real')).toBeInTheDocument();
  });
});
