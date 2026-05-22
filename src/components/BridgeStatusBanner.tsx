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
import { useDevGate } from '@/hooks/admin';
import { useBridgeStatusBanner } from '@/hooks/intelligence';

const BridgeStatusBannerInner = memo(function BridgeStatusBannerInner() {
  // O hook ainda precisa do flag para suprimir toasts internos.
  const { isAllowed } = useDevGate();
  const { unavailable, reason, closeUnavailable, reload } = useBridgeStatusBanner(isAllowed);

  if (!unavailable) return null;

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

/**
 * Variante mostrada para usuários sem o gate de dev quando a bridge cai.
 * Não vaza detalhes técnicos (sem `reason`, sem botão "Recarregar"
 * vermelho carregado) — só comunica indisponibilidade temporária.
 */
const PublicUnavailableBanner = memo(function PublicUnavailableBanner() {
  const { unavailable, closeUnavailable } = useBridgeStatusBanner(false);
  if (!unavailable) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      className="safe-area-top fixed inset-x-0 top-0 z-[60] border-b bg-muted text-foreground shadow-sm"
    >
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="font-medium">Catálogo temporariamente indisponível.</span>
          <span className="hidden opacity-80 sm:inline">
            Estamos restabelecendo a conexão — tente novamente em alguns instantes.
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={closeUnavailable}
          aria-label="Fechar aviso"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
});

export const BridgeStatusBanner = memo(function BridgeStatusBanner() {
  return (
    <DevOnly fallback={<PublicUnavailableBanner />}>
      <BridgeStatusBannerInner />
    </DevOnly>
  );
});
