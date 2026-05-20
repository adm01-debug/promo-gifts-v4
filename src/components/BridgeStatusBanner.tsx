/**
 * Banner global de status do external-db-bridge.
 *
 * Escuta o event bus de bridge-status-events e exibe avisos contextuais.
 * Restrito ao gate de infra dev para evitar vazamento de mensagens técnicas em prod.
 */
import { memo } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDevGate } from '@/hooks/admin';
import { useBridgeStatusBanner } from '@/hooks/intelligence';

const BridgeStatusBannerInner = memo(function BridgeStatusBannerInner() {
  // O hook ainda precisa do flag para suprimir toasts internos.
  const { isAllowed } = useDevGate();
  const { unavailable, reason, closeUnavailable, reload } = useBridgeStatusBanner(isAllowed);

  if (!unavailable) return null;

  // Avisos críticos de indisponibilidade total aparecem para TODOS. A cópia
  // varia: técnica para dev (isAllowed), amigável para usuários finais.
  const title = isAllowed ? 'Catálogo externo indisponível.' : 'Catálogo temporariamente indisponível';
  const description = isAllowed
    ? 'Tentativas automáticas esgotadas. Aguarde alguns segundos enquanto o serviço reinicia, ou recarregue a página.'
    : 'Estamos enfrentando uma instabilidade momentânea. Aguarde alguns segundos e tente novamente, ou recarregue a página.';

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
              {title}
            </span>{' '}
            <span className="opacity-90 block sm:inline leading-tight mt-1 sm:mt-0">
              {description}
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
            title={isAllowed ? reason : undefined}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
});

export const BridgeStatusBanner = memo(function BridgeStatusBanner() {
  // Sem gate de visibilidade no wrapper: o Inner sempre monta para registrar o
  // listener e exibir avisos CRÍTICOS a todos. A supressão de avisos técnicos
  // (infra/degraded) é feita dentro do hook via isAllowed.
  return <BridgeStatusBannerInner />;
});
