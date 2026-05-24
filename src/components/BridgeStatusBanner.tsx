/**
 * Banner global de status do external-db-bridge.
 *
 * Escuta o event bus de bridge-status-events e exibe avisos contextuais.
 * Usuários com acesso dev vêem a mensagem técnica completa; demais usuários
 * vêem uma mensagem genérica amigável quando o catálogo fica indisponível.
 */
import { memo } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDevGate } from '@/hooks/admin';
import { useBridgeStatusBanner } from '@/hooks/intelligence';

export const BridgeStatusBanner = memo(function BridgeStatusBanner() {
  // O hook ainda precisa do flag para suprimir toasts internos.
  const { isAllowed } = useDevGate();
  const { unavailable, reason, closeUnavailable, reload } = useBridgeStatusBanner(isAllowed);

  if (!unavailable) return null;

  // Usuários sem acesso ao gate de dev vêem mensagem genérica (sem detalhes técnicos).
  if (!isAllowed) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="safe-area-top fixed inset-x-0 top-0 z-[60] bg-destructive text-destructive-foreground shadow-md"
      >
        <div className="container mx-auto flex items-center gap-2 px-4 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <div>
            <span className="font-medium">Catálogo temporariamente indisponível.</span>
            <span className="mt-0.5 block text-xs opacity-90">
              Pode ser uma instabilidade momentânea. Tente recarregar a página em alguns instantes.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="safe-area-top fixed inset-x-0 top-0 z-[60] bg-destructive text-destructive-foreground shadow-md"
    >
      <div className="container mx-auto flex flex-col items-start justify-between gap-3 px-4 py-2 text-sm sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-2 sm:items-center">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <span className="block font-medium sm:inline">Catálogo externo indisponível.</span>{' '}
            <span className="mt-1 block leading-tight opacity-90 sm:mt-0 sm:inline">
              Tentativas automáticas esgotadas. Aguarde alguns segundos enquanto o serviço reinicia,
              ou recarregue a página.
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="secondary" className="h-7 gap-1.5" onClick={reload}>
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
