import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { onBridgeStatus, type BridgeStatusEvent } from '@/lib/external-db/bridge-status-events';

const TOAST_ID_DEGRADED = 'bridge-degraded';
const TOAST_ID_UNAVAILABLE = 'bridge-unavailable';

export function useBridgeStatusBanner(isAllowed: boolean) {
  const [unavailable, setUnavailable] = useState(false);
  const unavailableRef = useRef(false);
  const [reason, setReason] = useState<string>('');
  const lastDegradedAt = useRef(0);

  useEffect(() => {
    unavailableRef.current = unavailable;
  }, [unavailable]);

  const handleStatusEvent = useCallback((e: BridgeStatusEvent) => {
    if (e.type === 'degraded') {
      if (!isAllowed) return;

      const now = Date.now();
      if (now - lastDegradedAt.current < 8000) return;
      lastDegradedAt.current = now;
      
      toast.loading('Reconectando ao catálogo externo…', {
        id: TOAST_ID_DEGRADED,
        description: `Tentativa ${e.attempt}/${e.maxAttempts}. O sistema está se recuperando automaticamente.`,
        duration: 4000,
      });
    } else if (e.type === 'unavailable') {
      setUnavailable(true);
      setReason(e.reason);
      toast.dismiss(TOAST_ID_DEGRADED);

      // Toast técnico só para DEV — usuários finais não devem ver mensagens de infra.
      if (!isAllowed) return;

      toast.error('Catálogo temporariamente indisponível', {
        id: TOAST_ID_UNAVAILABLE,
        description: 'O serviço está reiniciando. Aguarde alguns segundos e tente novamente.',
        duration: Infinity,
        action: {
          label: 'Recarregar',
          onClick: () => window.location.reload(),
        },
      });
    } else if (e.type === 'recovered') {
      toast.dismiss(TOAST_ID_DEGRADED);
      if (unavailableRef.current) {
        if (isAllowed) {
          toast.success('Conexão restabelecida', {
            id: TOAST_ID_UNAVAILABLE,
            description: 'O catálogo voltou a responder normalmente.',
            duration: 4000,
          });
        } else {
          toast.dismiss(TOAST_ID_UNAVAILABLE);
        }
        setUnavailable(false);
        setReason('');
      } else if (isAllowed) {
        toast.success('Conexão normalizada', {
          id: TOAST_ID_DEGRADED,
          duration: 3000,
        });
      }
    }
  }, [isAllowed]);

  useEffect(() => {
    const unsubscribe = onBridgeStatus(handleStatusEvent);
    return () => {
      unsubscribe();
      toast.dismiss(TOAST_ID_DEGRADED);
    };
  }, [handleStatusEvent]);

  const closeUnavailable = useCallback(() => {
    setUnavailable(false);
    toast.dismiss(TOAST_ID_UNAVAILABLE);
  }, []);

  return {
    unavailable,
    reason,
    closeUnavailable,
    reload: () => window.location.reload()
  };
}
