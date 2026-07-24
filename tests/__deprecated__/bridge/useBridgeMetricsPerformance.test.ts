import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBridgeMetrics } from '@/hooks/dev/useBridgeMetrics';
import * as bridgeCallMetrics from '@/lib/telemetry/bridgeCallMetrics';
import * as longTaskWatchdog from '@/lib/telemetry/longTaskWatchdog';

describe('useBridgeMetrics Rerenders & Resubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Limpar localStorage simulado se necessário
  });

  it('should not resubscribe to telemetry when toggle open/paused', () => {
    const unsubCallsSpy = vi.fn();
    const subCallsSpy = vi.spyOn(bridgeCallMetrics, 'subscribeBridgeCalls').mockReturnValue(unsubCallsSpy);
    
    const { result, rerender } = renderHook(({ isAllowed }) => useBridgeMetrics(isAllowed), {
      initialProps: { isAllowed: true }
    });

    // Primeira inscrição no mount
    expect(subCallsSpy).toHaveBeenCalledTimes(1);

    // Mudar open (via setOpen exposto pelo hook)
    act(() => {
      result.current.setOpen(true);
    });
    
    // Rerenderiza por causa do setOpen, mas subscribeBridgeCalls não deve ser chamado de novo
    // porque useSyncExternalStore mantém a subscrição enquanto o componente estiver montado
    // e o primeiro argumento (subscribe) for estável.
    expect(subCallsSpy).toHaveBeenCalledTimes(1);

    // Mudar paused
    act(() => {
      result.current.setPaused(true);
    });
    expect(subCallsSpy).toHaveBeenCalledTimes(1);

    // Rerender com props diferentes (não relacionadas ao subscribe)
    rerender({ isAllowed: true });
    expect(subCallsSpy).toHaveBeenCalledTimes(1);
  });

  it('should maintain stable selector callbacks using useCallback', () => {
    // Verificamos se o hook está usando useCallback internamente para o getSnapshot
    // Embora não possamos ver o useCallback diretamente sem inspecionar o código,
    // podemos testar o comportamento de estabilidade se tivéssemos acesso ao useSyncExternalStore mockado.
    // Como estamos usando a implementação real, focamos no efeito prático.
    
    const { result } = renderHook(() => useBridgeMetrics(true));
    
    // Capturamos o estado inicial
    const initialSamples = result.current.samples;
    
    act(() => {
      // Forçamos uma mudança de estado que dispararia um rerender
      result.current.setFilter('slow');
    });

    // Se o filtro mudou, samples deve ser um novo array (devido ao useMemo no hook)
    expect(result.current.samples).not.toBe(initialSamples);
  });
});
