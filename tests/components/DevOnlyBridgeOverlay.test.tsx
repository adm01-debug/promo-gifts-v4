/**
 * DevOnlyBridgeOverlay — wrapper que gateia o BridgeMetricsOverlay por papel `dev`.
 *
 * Valida:
 *  - Não-dev: retorna null (sem montar o overlay, sem disparar o lazy import).
 *  - Dev: monta o overlay (via Suspense) — fallback null durante o load.
 *  - Gate desligado (env false) com isDev=true: retorna null.
 *  - Gate ligado por override (localStorage) com isDev=false: monta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DevOnlyBridgeOverlay } from '@/components/dev/DevOnlyBridgeOverlay';

import { useDevGate } from '@/hooks/admin/useDevGate';

vi.mock('@/hooks/admin/useDevGate', () => ({
  useDevGate: vi.fn(),
}));

// O overlay real importa telemetria + faz checks de import.meta.env.PROD.
// Mockamos como um marker simples para validar SOMENTE o gate.
vi.mock('@/components/dev/BridgeMetricsOverlay', () => ({
  default: () => <div data-testid="bridge-metrics-overlay-mock">overlay</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DevOnlyBridgeOverlay — gate por papel + SSOT', () => {
  it('NÃO renderiza overlay para usuário não-dev (default do gate)', () => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: false, isDev: false });
    const { container } = render(<DevOnlyBridgeOverlay />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('bridge-metrics-overlay-mock')).not.toBeInTheDocument();
  });

  it('renderiza overlay para usuário dev (gate aprovado por role)', async () => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: true, isDev: true });
    render(<DevOnlyBridgeOverlay />);
    expect(await screen.findByTestId('bridge-metrics-overlay-mock')).toBeInTheDocument();
  });

  // DevOnlyBridgeOverlay usa <DevOnly strict>, que decide EXCLUSIVAMENTE por
  // `isDev` (role dev real) e IGNORA overrides de env/localStorage (isAllowed).
  // Os dois casos abaixo cobrem justamente essa diferença entre `isDev` e
  // `isAllowed`.
  it('strict ignora override: isDev=true monta mesmo com isAllowed=false', async () => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: false, isDev: true });
    render(<DevOnlyBridgeOverlay />);
    expect(await screen.findByTestId('bridge-metrics-overlay-mock')).toBeInTheDocument();
  });

  it('strict ignora override: isAllowed=true mas isDev=false NÃO monta', () => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: true, isDev: false });
    const { container } = render(<DevOnlyBridgeOverlay />);
    expect(container).toBeEmptyDOMElement();
  });
});
