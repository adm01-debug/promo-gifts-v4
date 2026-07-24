import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BridgeMetricsOverlay from '../BridgeMetricsOverlay';
import { useBridgeMetrics, type BridgeMetricsFilter } from '@/hooks/dev/useBridgeMetrics';

vi.mock('@/hooks/dev/useBridgeMetrics', () => ({
  useBridgeMetrics: vi.fn(),
}));

describe('BridgeMetricsOverlay', () => {
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

  it('renderiza botão de toggle quando fechado', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useBridgeMetrics).mockReturnValue({ ...mockMetrics, open: false } as any);

    render(<BridgeMetricsOverlay />);

    expect(screen.getByTestId('bridge-metrics-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('bridge-metrics-overlay')).not.toBeInTheDocument();
  });

  it('renderiza o painel completo quando aberto', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useBridgeMetrics).mockReturnValue({ ...mockMetrics, open: true } as any);

    render(<BridgeMetricsOverlay />);

    expect(screen.getByTestId('bridge-metrics-overlay')).toBeInTheDocument();
    expect(screen.getByText('Bridge Metrics')).toBeInTheDocument();
    expect(screen.queryByTestId('bridge-metrics-toggle')).not.toBeInTheDocument();
  });

  it('chama setOpen(true) ao clicar no botão de toggle', () => {
    const setOpenMock = vi.fn();
    vi.mocked(useBridgeMetrics).mockReturnValue({
      ...mockMetrics,
      open: false,
      setOpen: setOpenMock,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<BridgeMetricsOverlay />);
    fireEvent.click(screen.getByTestId('bridge-metrics-toggle'));

    expect(setOpenMock).toHaveBeenCalledWith(true);
  });

  it('chama setOpen(false) ao clicar no botão de fechar', () => {
    const setOpenMock = vi.fn();
    vi.mocked(useBridgeMetrics).mockReturnValue({
      ...mockMetrics,
      open: true,
      setOpen: setOpenMock,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<BridgeMetricsOverlay />);
    fireEvent.click(screen.getByText('X'));

    expect(setOpenMock).toHaveBeenCalledWith(false);
  });
});
