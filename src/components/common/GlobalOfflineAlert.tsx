import { useState, useEffect, useRef } from 'react';
import { WifiOff, X, Wifi } from 'lucide-react';
import { toast } from 'sonner';

export function GlobalOfflineAlert() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const [dismissed, setDismissed] = useState(false);
  const wasOfflineRef = useRef(false);

  const showOverlay = isOffline && !dismissed;

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
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-destructive p-4 text-destructive-foreground shadow-2xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
          <WifiOff className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Você está offline</p>
          <p className="truncate text-xs opacity-90">
            Algumas funcionalidades podem não estar disponíveis.
          </p>
        </div>
        <div className="flex items-center gap-1">
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
