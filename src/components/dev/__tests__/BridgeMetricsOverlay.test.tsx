import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BridgeMetricsOverlay from '../BridgeMetricsOverlay';
import { useDevGate } from '@/hooks/admin';
import { useBridgeMetrics, type BridgeMetricsFilter } from '@/hooks/dev/useBridgeMetrics';

// Mocks
vi.mock('@/hooks/admin', () => ({
  useDevGate: vi.fn(),
}));

vi.mock('@/hooks/dev/useBridgeMetrics', () => ({
  useBridgeMetrics: vi.fn(),
}));

// We need to mock import.meta.env.PROD
// Vitest allows this via vi.stubEnv or define
vi.stubEnv('PROD', false); // Ensure it's not PROD by default

describe('BridgeMetricsOverlay Regression Tests', () => {
  const mockMetrics = {
    open: false,
    setOpen: vi.fn(),
    paused: false,
    setPaused: vi.fn(),
    filter: 'all' as BridgeMetricsFilter,
    setFilter: vi.fn(),
    tab: 'calls',
    setTab: vi.fn(),
    samples: [],
    longTasks: [],
    summary: { count: 0, avgMs: 0, p95Ms: 0, errorRate: 0 },
    clear: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna null quando NÃO é dev (mesmo com isAllowed=true para admin)', () => {
    // Regressão: admin tinha isAllowed=true e via o overlay. Agora deve ficar oculto.
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: true, isDev: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useBridgeMetrics).mockReturnValue(mockMetrics as any);

    const { container } = render(<BridgeMetricsOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('retorna null quando não há acesso algum', () => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: false, isDev: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useBridgeMetrics).mockReturnValue(mockMetrics as any);

    const { container } = render(<BridgeMetricsOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza o botão flutuante quando isDev=true e fechado', () => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: true, isDev: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useBridgeMetrics).mockReturnValue({ ...mockMetrics, open: false } as any);

    render(<BridgeMetricsOverlay />);
    expect(screen.getByRole('button', { name: /Abrir métricas de bridge/i })).toBeInTheDocument();
  });

  it('renderiza o painel completo quando isDev=true e aberto', () => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: true, isDev: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useBridgeMetrics).mockReturnValue({ ...mockMetrics, open: true } as any);

    render(<BridgeMetricsOverlay />);
    expect(screen.getByText('Métricas de Bridge')).toBeInTheDocument();
    expect(screen.getByText('live')).toBeInTheDocument();
  });

  it('should toggle between calls and longtasks tabs', () => {
    const setTabMock = vi.fn();
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: true, isDev: true });

    vi.mocked(useBridgeMetrics).mockReturnValue({
      ...mockMetrics,
      open: true,
      setTab: setTabMock,
    } as any);

    render(<BridgeMetricsOverlay />);
    const longTasksTab = screen.getByText(/longtasks/i);
    fireEvent.click(longTasksTab);

    expect(setTabMock).toHaveBeenCalledWith('longtasks');
  });
});
