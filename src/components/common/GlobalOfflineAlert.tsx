import { useState, useEffect, useRef } from 'react';
import { WifiOff, X, Wifi } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * Global component to detect and display browser-level offline status.
 */
export function GlobalOfflineAlert() {
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [dismissed, setDismissed] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setDismissed(false);
      if (wasOfflineRef.current) {
        toast.success("Conexão restaurada", {
          description: "Sua conexão com a internet voltou.",
          icon: <Wifi className="h-4 w-4 text-success" />,
          duration: 4000
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

  if (!isOffline || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-md"
      >
        <div className="bg-destructive text-destructive-foreground p-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <WifiOff className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Você está offline</p>
            <p className="text-xs opacity-90 truncate">Algumas funcionalidades podem não estar disponíveis.</p>
          </div>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-8 w-8 text-white hover:bg-white/10 rounded-full"
            onClick={() => setDismissed(true)}
            aria-label="Dispensar aviso de offline"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
