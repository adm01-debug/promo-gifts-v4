/**
 * DevOnlyBridgeOverlay — wrapper que gateia o BridgeMetricsOverlay por papel `dev`.
 *
 * Valida:
 *  - Não-dev: retorna null (sem montar o overlay, sem disparar o lazy import).
 *  - Dev: monta o overlay (via Suspense) — fallback null durante o load.
 *  - Modo `strict` (gate por isDev): dev real (isDev=true) SEMPRE monta, ignorando override de env/localStorage.
 *  - Modo `strict`: não-dev (isDev=false) NUNCA monta, mesmo com override (isAllowed=true).
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

  it('modo strict: dev real monta mesmo com SSOT/env off (gate por isDev)', async () => {
    // <DevOnly strict> gateia por isDev, ignorando override de env/localStorage (isAllowed).
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: false, isDev: true });
    render(<DevOnlyBridgeOverlay />);
    expect(await screen.findByTestId('bridge-metrics-overlay-mock')).toBeInTheDocument();
  });

  it('modo strict: override (isAllowed=true) NÃO habilita não-dev (gate por isDev)', () => {
    // strict ignora override; não-dev (isDev=false) não monta o overlay.
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: true, isDev: false });
    const { container } = render(<DevOnlyBridgeOverlay />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('bridge-metrics-overlay-mock')).not.toBeInTheDocument();
  });
});
