/**
 * BridgeStatusBanner — gating dev-only (infra + crítico)
 *
 * Nova convenção (re-import): TODO o banner fica atrás de <DevOnly> (gate isAllowed).
 * Com o gate aberto (dev/override), o inner monta, registra o listener de bridge-status
 * e exibe avisos de infra (toast) e críticos (alert técnico). Com o gate fechado
 * (não-dev / PROD), o inner não monta: nenhum listener é registrado e nada é exibido.
 * NB: a mensagem "amigável" para usuário final NÃO existe mais neste componente.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BridgeStatusBanner } from '@/components/BridgeStatusBanner';
import type { BridgeStatusEvent } from '@/lib/external-db/bridge-status-events';

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  },
}));
import { toast } from 'sonner';
const toastApi = toast as unknown as {
  loading: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  dismiss: ReturnType<typeof vi.fn>;
};

// Capturamos o listener registrado por onBridgeStatus para emitir eventos sintéticos.
let listener: ((e: BridgeStatusEvent) => void) | null = null;
const onBridgeStatusMock = vi.fn((cb: (e: BridgeStatusEvent) => void) => {
  listener = cb;
  return () => {
    listener = null;
  };
});
vi.mock('@/lib/external-db/bridge-status-events', () => ({
  onBridgeStatus: (cb: (e: BridgeStatusEvent) => void) => onBridgeStatusMock(cb),
}));

// Mock do gate para controlar o ambiente
const mockShouldShow = vi.fn();
vi.mock('@/lib/system/dev-infra-messages', () => ({
  shouldShowDevInfraMessages: (isDev: boolean) => mockShouldShow(isDev),
}));

// Mock do hook useDevGate (já que o componente o usa agora)
vi.mock('@/hooks/admin/useDevGate', () => ({
  useDevGate: () => ({
    isAllowed: mockShouldShow(mockUseAuth().isDev),
    isDev: mockUseAuth().isDev
  })
}));

function emit(event: BridgeStatusEvent) {
  act(() => {
    listener?.(event);
  });
}

beforeEach(() => {
  mockUseAuth.mockReset();
  mockShouldShow.mockReset();
  // Por padrão: segue o isDev
  mockShouldShow.mockImplementation((isDev: boolean) => isDev);
  onBridgeStatusMock.mockClear();
  listener = null;
  toastApi.loading.mockClear();
  toastApi.error.mockClear();
  toastApi.success.mockClear();
  toastApi.dismiss.mockClear();
});

describe('BridgeStatusBanner — visibilidade por papel e ambiente', () => {
  it('usuário NÃO-dev: gate fechado — não registra listener nem exibe banner (tudo dev-only)', () => {
    mockUseAuth.mockReturnValue({ isDev: false });
    render(<BridgeStatusBanner />);

    // Gate fechado: o inner (que registra o listener) está atrás de <DevOnly> e não monta.
    expect(onBridgeStatusMock).not.toHaveBeenCalled();
    expect(toastApi.loading).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('usuário dev: exibe avisos de infra e avisos críticos com cópia técnica', () => {
    mockUseAuth.mockReturnValue({ isDev: true });
    render(<BridgeStatusBanner />);

    // Degraded (infra) -> Exibe
    emit({ type: 'degraded', attempt: 1, maxAttempts: 3 } as any);
    expect(toastApi.loading).toHaveBeenCalled();

    // Unavailable (crítico) -> Exibe com texto técnico
    emit({ type: 'unavailable', reason: 'Cold start failed' } as any);
    expect(screen.getByText(/Catálogo externo indisponível/i)).toBeInTheDocument();
    expect(screen.getByText(/Tentativas automáticas esgotadas/i)).toBeInTheDocument();
  });

  it('Modo PROD (gate fechado) bloqueia TODO o banner mesmo para Dev (infra e crítico)', () => {
    mockUseAuth.mockReturnValue({ isDev: true });
    mockShouldShow.mockReturnValue(false); // SSOT/PROD fecha o gate (isAllowed=false)
    render(<BridgeStatusBanner />);

    // Gate fechado: inner não monta -> sem listener, sem toast, sem alert.
    expect(onBridgeStatusMock).not.toHaveBeenCalled();
    expect(toastApi.loading).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('limpa avisos ao receber evento "recovered"', () => {
    mockUseAuth.mockReturnValue({ isDev: true });
    render(<BridgeStatusBanner />);

    emit({ type: 'unavailable', reason: 'error' } as any);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    emit({ type: 'recovered' } as any);
    expect(toastApi.dismiss).toHaveBeenCalledWith('bridge-degraded');
    expect(toastApi.success).toHaveBeenCalledWith('Conexão restabelecida', expect.anything());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
