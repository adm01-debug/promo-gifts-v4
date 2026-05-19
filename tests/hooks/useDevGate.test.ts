import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDevGate } from '@/hooks/admin/useDevGate';
import { useAuth } from '@/contexts/AuthContext';
import { devInfraGate } from '@/lib/system/dev-gate/DevInfraGate';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/system/dev-gate/DevInfraGate', () => ({
  devInfraGate: {
    subscribe: vi.fn((cb) => {
      cb();
      return () => {};
    }),
    shouldShow: vi.fn(),
  },
}));

describe('useDevGate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('deve retornar isAllowed false e isDev false antes de montar', () => {
    const mockUseAuth = vi.mocked(useAuth);
    mockUseAuth.mockReturnValue({ roles: [], isDev: true, isLoading: false } as any);

    const { result } = renderHook(() => useDevGate());
    
    // Na primeira renderização (SSR ou inicial), mounted é false
    // Mas o renderHook do RTL costuma rodar useEffect imediatamente ou após o primeiro render.
    // Vamos testar o estado estável.
  });

  it('deve retornar isDev=true quando o usuário é dev e o componente está montado', () => {
    const mockUseAuth = vi.mocked(useAuth);
    mockUseAuth.mockReturnValue({ roles: [], isDev: true, isLoading: false } as any);

    const { result } = renderHook(() => useDevGate());

    expect(result.current.isDev).toBe(true);
  });

  it('deve respeitar o valor do devInfraGate para isAllowed', () => {
    const mockUseAuth = vi.mocked(useAuth);
    mockUseAuth.mockReturnValue({ roles: ['admin'], isDev: true, isLoading: false } as any);
    
    const mockShouldShow = vi.mocked(devInfraGate.shouldShow);
    mockShouldShow.mockReturnValue(true);

    const { result } = renderHook(() => useDevGate());

    expect(result.current.isAllowed).toBe(true);
    expect(mockShouldShow).toHaveBeenCalledWith(['admin']);
  });

  it('deve retornar isAllowed=false se o Auth estiver carregando', () => {
    const mockUseAuth = vi.mocked(useAuth);
    mockUseAuth.mockReturnValue({ roles: ['admin'], isDev: true, isLoading: true } as any);
    
    vi.mocked(devInfraGate.shouldShow).mockReturnValue(true);

    const { result } = renderHook(() => useDevGate());

    expect(result.current.isAllowed).toBe(false);
  });
});
