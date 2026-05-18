/**
 * Banner global de status do external-db-bridge.
 *
 * Escuta o event bus de bridge-status-events e exibe avisos contextuais.
 * Restrito ao gate de infra dev para evitar vazamento de mensagens técnicas em prod.
 */
import { memo } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DevOnly } from '@/components/dev/DevOnly';
import { useDevGate } from '@/hooks/useDevGate';
import { useBridgeStatusBanner } from '@/hooks/useBridgeStatusBanner';

const BridgeStatusBannerInner = memo(function BridgeStatusBannerInner() {
  // O hook ainda precisa do flag para suprimir toasts internos.
  const { isAllowed } = useDevGate();
  const { unavailable, reason, closeUnavailable, reload } = useBridgeStatusBanner(isAllowed);

  if (!unavailable) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[60] bg-destructive text-destructive-foreground shadow-md safe-area-top"
    >
      <div className="container mx-auto px-4 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
        <div className="flex items-start sm:items-center gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <span className="font-medium block sm:inline">
              Catálogo externo indisponível.
            </span>{' '}
            <span className="opacity-90 block sm:inline leading-tight mt-1 sm:mt-0">
              Tentativas automáticas esgotadas. Aguarde alguns segundos enquanto o serviço reinicia, ou recarregue a página.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 gap-1.5"
            onClick={reload}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Recarregar
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive-foreground hover:bg-destructive-foreground/10"
            onClick={closeUnavailable}
            aria-label="Fechar aviso"
            title={reason}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
});

export const BridgeStatusBanner = memo(function BridgeStatusBanner() {
  return (
    <DevOnly>
      <BridgeStatusBannerInner />
    </DevOnly>
  );
});
