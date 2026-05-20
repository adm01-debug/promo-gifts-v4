import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '../test-utils';
import { CloudStatusBanner } from '@/components/system/CloudStatusBanner';
import { BridgeStatusBanner } from '@/components/BridgeStatusBanner';
import { emitBridgeStatus } from '@/lib/external-db/bridge-status-events';
import { toast } from 'sonner';

// Mocks
vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseCloudStatus = vi.fn();
vi.mock('@/hooks/ui/useCloudStatus', () => ({
  useCloudStatus: () => mockUseCloudStatus(),
}));

// Helper para simular ambiente de PROD (gate fechado para não-devs)
const setupProdNonDev = () => {
  mockUseAuth.mockReturnValue({ isDev: false });
  vi.stubEnv('VITE_SHOW_DEV_INFRA_MESSAGES', 'false');
  // Limpar localStorage para garantir que não há overrides
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('show_dev_infra_messages');
  }
};

describe('E2E Infra Banners — Modo PROD (Usuário Não-Dev)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupProdNonDev();
  });

  describe('CloudStatusBanner', () => {
    it('OCULTA mensagem técnica "warming" (reiniciando)', () => {
      mockUseCloudStatus.mockReturnValue({
        status: 'warming',
        retry: vi.fn(),
        isChecking: false
      });

      const { container } = render(<CloudStatusBanner />);
      expect(container).toBeEmptyDOMElement();
    });

    it('EXIBE mensagem crítica "down" (indisponível)', () => {
      mockUseCloudStatus.mockReturnValue({
        status: 'down',
        retry: vi.fn(),
        isChecking: false
      });

      render(<CloudStatusBanner />);
      expect(screen.getByText(/Backend indisponível/i)).toBeInTheDocument();
      // Não deve ter a classe de spin (que é do warming)
      const icon = screen.getByRole('status').querySelector('svg');
      expect(icon).not.toHaveClass('animate-spin');
    });

    it('EXIBE mensagem de instabilidade "degraded"', () => {
      mockUseCloudStatus.mockReturnValue({
        status: 'degraded',
        retry: vi.fn(),
        isChecking: false
      });

      render(<CloudStatusBanner />);
      expect(screen.getByText(/Backend instável/i)).toBeInTheDocument();
    });
  });

  describe('BridgeStatusBanner', () => {
    it('OCULTA toast técnico de "degraded" (reconectando)', () => {
      render(<BridgeStatusBanner />);
      
      act(() => {
        emitBridgeStatus({ 
          type: 'degraded', 
          attempt: 1, 
          maxAttempts: 3, 
          delayMs: 1000, 
          reason: '503 cold start' 
        });
      });

      expect(toast.loading).not.toHaveBeenCalled();
    });

    it('EXIBE banner crítico "unavailable" com texto amigável (não técnico)', () => {
      render(<BridgeStatusBanner />);
      
      act(() => {
        emitBridgeStatus({ 
          type: 'unavailable', 
          reason: 'Circuit breaker open', 
          attempts: 5 
        });
      });

      // Verifica o banner sticky
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Catálogo temporariamente indisponível/i)).toBeInTheDocument();
      
      // Verifica que NÃO usa a mensagem técnica reservada para devs
      expect(screen.queryByText(/Tentativas automáticas esgotadas/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Estamos com uma instabilidade momentânea no catálogo/i)).toBeInTheDocument();

      // Verifica o toast de erro
      expect(toast.error).toHaveBeenCalledWith(
        'Catálogo temporariamente indisponível',
        expect.objectContaining({
          description: expect.stringContaining('Estamos com uma instabilidade momentânea no acesso ao catálogo')
        })
      );
    });

    it('PERMITE fechar o aviso mesmo em modo crítico', async () => {
      render(<BridgeStatusBanner />);
      
      act(() => {
        emitBridgeStatus({ type: 'unavailable', reason: 'fail', attempts: 1 });
      });

      const closeButton = screen.getByLabelText(/Fechar aviso/i);
      act(() => {
        closeButton.click();
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
