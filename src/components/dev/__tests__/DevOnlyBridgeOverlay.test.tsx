/**
 * Gate test: DevOnlyBridgeOverlay deve montar o overlay APENAS para isDev=true.
 * Admin (isAllowed=true, isDev=false) NÃO pode ver "bridge metrics".
 */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DevOnlyBridgeOverlay } from '../DevOnlyBridgeOverlay';
import { useDevGate } from '@/hooks/useDevGate';

vi.mock('@/hooks/useDevGate', () => ({
  useDevGate: vi.fn(),
}));

// Stub do componente lazy para evitar setup pesado de hooks internos.
vi.mock('../BridgeMetricsOverlay', () => ({
  default: () => <div data-testid="bridge-metrics-overlay-mount" />,
}));

describe('DevOnlyBridgeOverlay — gate por role dev', () => {
  beforeEach(() => vi.clearAllMocks());

  it('NÃO renderiza para admin (isAllowed=true, isDev=false)', () => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: true, isDev: false });
    const { container } = render(<DevOnlyBridgeOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('NÃO renderiza para usuário sem acesso', () => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: false, isDev: false });
    const { container } = render(<DevOnlyBridgeOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza o overlay quando isDev=true', async () => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: true, isDev: true });
    const { findByTestId } = render(<DevOnlyBridgeOverlay />);
    expect(await findByTestId('bridge-metrics-overlay-mount')).toBeInTheDocument();
  });
});
