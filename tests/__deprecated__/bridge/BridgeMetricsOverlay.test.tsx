import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BridgeMetricsOverlay from '@/components/dev/BridgeMetricsOverlay';
import { useDevGate } from '@/hooks/admin/useDevGate';
import { useBridgeMetrics } from '@/hooks/dev/useBridgeMetrics';

vi.mock('@/hooks/admin/useDevGate', () => ({
  useDevGate: vi.fn(),
}));

vi.mock('@/hooks/dev/useBridgeMetrics', () => ({
  useBridgeMetrics: vi.fn(),
}));

describe('BridgeMetricsOverlay', () => {
  const mockClear = vi.fn();
  const mockSetOpen = vi.fn();
  const mockSetPaused = vi.fn();
  const mockSetFilter = vi.fn();
  const mockSetTab = vi.fn();

  const defaultMockValues = {
    open: true,
    setOpen: mockSetOpen,
    paused: false,
    setPaused: mockSetPaused,
    filter: 'all',
    setFilter: mockSetFilter,
    tab: 'calls',
    setTab: mockSetTab,
    samples: [
      { id: '1', bridge: 'crm-bridge', op: 'get_user', durationMs: 100, respBytes: 1024, ok: true, status: 200 },
      { id: '2', bridge: 'external-db-bridge', op: 'query', durationMs: 700, respBytes: 500, ok: true, status: 200 },
      { id: '3', bridge: 'crm-bridge', op: 'update_user', durationMs: 150, respBytes: 200, ok: false, status: 500 },
    ],
    longTasks: [],
    summary: { total: 3, avg: 316, totalResp: 1724, errors: 1, last20: 3 },
    clear: mockClear,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useDevGate as any).mockReturnValue({ isAllowed: true, isDev: true });
    (useBridgeMetrics as any).mockReturnValue(defaultMockValues);
  });

  it('não deve renderizar nada se isAllowed for false', () => {
    (useDevGate as any).mockReturnValue({ isAllowed: false, isDev: true });
    const { container } = render(<BridgeMetricsOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('deve renderizar o botão de abertura quando fechado', () => {
    (useBridgeMetrics as any).mockReturnValue({
      ...defaultMockValues,
      open: false,
    });
    render(<BridgeMetricsOverlay />);
    expect(screen.getByRole('button', { name: /Abrir métricas/i })).toBeInTheDocument();
  });

  it('deve chamar setOpen(true) ao clicar no botão de abertura', () => {
    (useBridgeMetrics as any).mockReturnValue({
      ...defaultMockValues,
      open: false,
    });
    render(<BridgeMetricsOverlay />);
    fireEvent.click(screen.getByRole('button', { name: /Abrir métricas/i }));
    expect(mockSetOpen).toHaveBeenCalledWith(true);
  });

  it('deve renderizar a lista de chamadas corretamente', () => {
    render(<BridgeMetricsOverlay />);
    expect(screen.getByText('get_user')).toBeInTheDocument();
    expect(screen.getByText('query')).toBeInTheDocument();
    expect(screen.getByText('update_user')).toBeInTheDocument();
    expect(screen.getByText('100ms')).toBeInTheDocument();
    expect(screen.getByText('700ms')).toBeInTheDocument();
    expect(screen.getByText('150ms')).toBeInTheDocument();
  });

  it('deve permitir trocar de aba para longtasks', () => {
    render(<BridgeMetricsOverlay />);
    fireEvent.click(screen.getByText('longtasks'));
    expect(mockSetTab).toHaveBeenCalledWith('longtasks');
  });

  it('deve exibir filtros apenas na aba de chamadas', () => {
    const { rerender } = render(<BridgeMetricsOverlay />);
    expect(screen.getByRole('button', { name: 'all' })).toBeInTheDocument();
    
    const errorButtons = screen.getAllByText('errors').filter(el => el.tagName === 'BUTTON');
    expect(errorButtons.length).toBe(1);

    (useBridgeMetrics as any).mockReturnValue({
      ...defaultMockValues,
      tab: 'longtasks',
    });
    rerender(<BridgeMetricsOverlay />);
    expect(screen.queryByRole('button', { name: 'all' })).not.toBeInTheDocument();
  });

  it('deve chamar setFilter ao clicar nos botões de filtro', () => {
    render(<BridgeMetricsOverlay />);
    fireEvent.click(screen.getByText('≥600ms'));
    expect(mockSetFilter).toHaveBeenCalledWith('slow');
    
    const errorButton = screen.getAllByText('errors').find(el => el.tagName === 'BUTTON');
    fireEvent.click(errorButton!);
    expect(mockSetFilter).toHaveBeenCalledWith('errors');
  });

  it('deve permitir pausar/retomar live updates', () => {
    render(<BridgeMetricsOverlay />);
    fireEvent.click(screen.getByText('live'));
    expect(mockSetPaused).toHaveBeenCalled();
  });

  it('deve mostrar estado "paused" quando pausado', () => {
    (useBridgeMetrics as any).mockReturnValue({
      ...defaultMockValues,
      paused: true,
    });
    render(<BridgeMetricsOverlay />);
    expect(screen.getByText('paused')).toBeInTheDocument();
  });

  it('deve chamar clear ao clicar no botão limpar', () => {
    render(<BridgeMetricsOverlay />);
    fireEvent.click(screen.getByText('clear'));
    expect(mockClear).toHaveBeenCalled();
  });

  it('deve fechar o overlay ao clicar no X', () => {
    render(<BridgeMetricsOverlay />);
    fireEvent.click(screen.getByText('✕'));
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });
});
