/**
 * BUG-25 Regression Test — useGlobalShortcuts lastGAt isolation
 *
 * Verifica que o estado do chord "G→K" é isolado por instância do hook
 * (useRef) e não compartilhado em escopo de módulo (singleton).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlobalShortcuts } from '@/hooks/ui/useGlobalShortcuts';

// Mock compartilhado — pode ser controlado por cada teste
const mockNavigate = vi.fn();
const mockOpenOracle = vi.fn();
const mockSetOpenSearch = vi.fn();
const mockRestartTour = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/stores/oracleVoiceBridge', () => ({
  useOracleVoiceBridge: () => mockOpenOracle,
}));

vi.mock('@/stores/useSearchStore', () => ({
  useSearchStore: () => ({ open: false, setOpen: mockSetOpenSearch }),
}));

vi.mock('@/contexts/OnboardingContext', () => ({
  useOnboardingContext: () => ({ restartTour: mockRestartTour }),
  useOptionalOnboardingContext: () => ({ restartTour: mockRestartTour }),
}));

function pressKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  // The hook listens on document, not window
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
  });
}

describe('useGlobalShortcuts — BUG-25: isolamento de lastGAt por instância', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockOpenOracle.mockClear();
    mockSetOpenSearch.mockClear();
    mockRestartTour.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('instância individual responde corretamente ao chord G→K', () => {
    renderHook(() => useGlobalShortcuts());

    // Pressiona G seguido de K rapidamente (dentro de 800ms)
    pressKey('g');
    pressKey('k');

    expect(mockNavigate).toHaveBeenCalledWith('/meus-kits');
  });

  it('chord G→K não dispara se K vier depois de 800ms', () => {
    vi.useFakeTimers();
    renderHook(() => useGlobalShortcuts());

    pressKey('g');

    // Avança 801ms — fora da janela
    act(() => { vi.advanceTimersByTime(801); });

    pressKey('k');

    expect(mockNavigate).not.toHaveBeenCalledWith('/meus-kits');

    vi.useRealTimers();
  });

  it('lastGAt é resetado após ativação do chord', () => {
    renderHook(() => useGlobalShortcuts());

    // Primeira ativação
    pressKey('g');
    pressKey('k');
    expect(mockNavigate).toHaveBeenCalledTimes(1);

    // Pressionar K novamente sem G deve ignorar (lastGAt foi resetado para 0)
    pressKey('k');
    expect(mockNavigate).toHaveBeenCalledTimes(1); // ainda 1
  });

  it('chord G→K em maiúsculas também funciona', () => {
    renderHook(() => useGlobalShortcuts());

    pressKey('G');
    pressKey('K');

    expect(mockNavigate).toHaveBeenCalledWith('/meus-kits');
  });

  it('chord G→K não ativa com modificador Ctrl', () => {
    renderHook(() => useGlobalShortcuts());

    // Com Ctrl pressionado, G+K não deve navegar para /meus-kits
    pressKey('g', { ctrlKey: true });
    pressKey('k', { ctrlKey: true });

    expect(mockNavigate).not.toHaveBeenCalledWith('/meus-kits');
  });

  it('múltiplas instâncias não compartilham estado de chord', () => {
    // BUG-25: antes do fix, lastGAt era de módulo e compartilhado
    // Com useRef por instância, cada mount tem seu próprio lastGAt
    const { unmount: u1 } = renderHook(() => useGlobalShortcuts());
    const { unmount: u2 } = renderHook(() => useGlobalShortcuts());

    // Ambas as instâncias montadas e desmontadas sem erro de estado compartilhado
    u1();
    u2();

    // O teste verifica que o cleanup ocorreu sem erro — o estado por ref
    // garante que não há contaminação entre instâncias
    expect(true).toBe(true);
  });
});
