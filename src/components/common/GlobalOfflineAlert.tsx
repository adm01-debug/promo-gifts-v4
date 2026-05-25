import { useState, useEffect, useRef } from 'react';
import { WifiOff, X, Wifi, AlertCircle, RefreshCw } from 'lucide-react';
import { useBridgeStatusBanner } from '@/hooks/intelligence/useBridgeStatusBanner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Global component to detect and display browser-level offline status.
 */
export function GlobalOfflineAlert() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const [dismissed, setDismissed] = useState(false);
  const wasOfflineRef = useRef(false);

  // Also track bridge status for a more comprehensive overlay
  const { unavailable: bridgeUnavailable, reload: reloadBridge } = useBridgeStatusBanner(false);
  const showOverlay = (isOffline || bridgeUnavailable) && !dismissed;

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setDismissed(false);
      if (wasOfflineRef.current) {
        toast.success('Conexão restaurada', {
          description: 'Sua conexão com a internet voltou.',
          icon: <Wifi className="h-4 w-4 text-success" />,
          duration: 4000,
        });
        wasOfflineRef.current = false;
      }
    };
    const handleOffline = () => {
      setIsOffline(true);
      wasOfflineRef.current = true;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showOverlay) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2">
      <div
        className={cn(
          'flex items-center gap-4 rounded-2xl border border-white/10 p-4 shadow-2xl',
          isOffline
            ? 'bg-destructive text-destructive-foreground'
            : 'bg-warning text-warning-foreground',
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
          {isOffline ? <WifiOff className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {isOffline ? 'Você está offline' : 'Catálogo indisponível'}
          </p>
          <p className="truncate text-xs opacity-90">
            {isOffline
              ? 'Algumas funcionalidades podem não estar disponíveis.'
              : 'Não conseguimos conectar ao banco de dados externo.'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {!isOffline && bridgeUnavailable && (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
              onClick={() => reloadBridge()}
              title="Tentar reconectar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            onClick={() => setDismissed(true)}
            aria-label="Dispensar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
