import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import BridgeMetricsOverlay from '@/components/dev/BridgeMetricsOverlay';
import { useDevGate } from '@/hooks/admin/useDevGate';

vi.mock('@/hooks/admin/useDevGate', () => ({
  useDevGate: vi.fn(),
}));

vi.mock('@/lib/telemetry/bridgeCallMetrics', () => ({
  getBridgeSamples: vi.fn(() => []),
  subscribeBridgeCalls: vi.fn(() => () => {}),
  clearBridgeSamples: vi.fn(),
}));

vi.mock('@/lib/telemetry/longTaskWatchdog', () => ({
  getLongTaskEvents: vi.fn(() => []),
  subscribeLongTasks: vi.fn(() => () => {}),
  clearLongTaskEvents: vi.fn(),
  describeLongTask: vi.fn(),
}));

describe('BridgeMetricsOverlay - Gating de Produção', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * NOTA SOBRE O TESTE DE PROD:
   * Em ambientes Vite/Vitest, `import.meta.env.PROD` é frequentemente resolvido em tempo de build 
   * ou mockado globalmente pelo ambiente de teste como `false`. 
   * 
   * O teste abaixo valida que a lógica de gating de RUNTIME (SSOT) está ativa, 
   * garantindo que mesmo que o guard de build (PROD) falhe por erro de configuração do ambiente,
   * o overlay ainda respeita a flag de infraestrutura de dev.
   */
  
  it('renderiza normalmente se o gate SSOT aprovar', () => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: true, isDev: true });
    const { container } = render(<BridgeMetricsOverlay />);
    expect(container).not.toBeEmptyDOMElement();
    expect(container.textContent).toContain('bridge metrics');
  });

  it('retorna null se o gate SSOT REJEITAR (mesmo que seja dev)', () => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: false, isDev: true });
    const { container } = render(<BridgeMetricsOverlay />);
    expect(container).toBeEmptyDOMElement();
  });
});

