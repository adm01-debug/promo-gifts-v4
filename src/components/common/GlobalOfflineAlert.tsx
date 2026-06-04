import { useState, useEffect, useRef } from 'react';
import { WifiOff, X, Wifi, CloudOff } from 'lucide-react';
import { toast } from 'sonner';

/**
 * GlobalOfflineAlert — banner global de offline com proteção de formulários.
 *
 * Além do banner visual, adiciona `data-offline="true"` ao `<body>` quando
 * a rede cai. O CSS global em `index.css` usa este atributo para desabilitar
 * visualmente botões de submit enquanto o usuário está sem conexão.
 *
 * Pattern de CSS a adicionar em index.css:
 *   body[data-offline="true"] button[type="submit"],
 *   body[data-offline="true"] [data-offline-disabled="true"] {
 *     pointer-events: none;
 *     opacity: 0.5;
 *     cursor: not-allowed;
 *   }
 */
export function GlobalOfflineAlert() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const [dismissed, setDismissed] = useState(false);
  const wasOfflineRef = useRef(false);

  const showOverlay = isOffline && !dismissed;

  useEffect(() => {
    // Sincroniza o data-attribute no body para CSS global poder desabilitar
    // botões de submit enquanto o usuário está sem conexão.
    if (typeof document !== 'undefined') {
      if (isOffline) {
        document.body.setAttribute('data-offline', 'true');
      } else {
        document.body.removeAttribute('data-offline');
      }
    }
  }, [isOffline]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setDismissed(false);
      if (wasOfflineRef.current) {
        toast.success('Conexão restaurada', {
          description: 'Sua conexão com a internet voltou. Você pode salvar normalmente.',
          icon: <Wifi className="h-4 w-4 text-success" />,
          duration: 4000,
        });
        wasOfflineRef.current = false;
      }
    };
    const handleOffline = () => {
      setIsOffline(true);
      setDismissed(false);
      wasOfflineRef.current = true;
      // Toast adicional para garantir visibilidade mesmo se o banner estiver fora do viewport
      toast.error('Sem conexão', {
        description: 'Operações de salvamento estão desabilitadas até a conexão ser restaurada.',
        icon: <CloudOff className="h-4 w-4" />,
        duration: 6000,
        id: 'global-offline-toast',
      });
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
    <div
      className="fixed bottom-6 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-destructive p-4 text-destructive-foreground shadow-2xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
          <WifiOff className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Você está offline</p>
          <p className="truncate text-xs opacity-90">
            Salvamentos bloqueados. Reconecte para continuar.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            onClick={() => setDismissed(true)}
            aria-label="Dispensar aviso de conexão"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
