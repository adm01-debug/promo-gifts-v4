import React, { useState, useEffect, lazy, Suspense } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles } from 'lucide-react';
import { useOracleVoiceBridge } from '@/stores/oracleVoiceBridge';

// Lazy-load the heavy dialog — only loads when opened
const ExpertChatDialog = lazy(() =>
  import('./ExpertChatDialog').then((m) => ({ default: m.ExpertChatDialog })),
);

interface ExpertChatButtonProps {
  clientId?: string;
  clientName?: string;
}

export const ExpertChatButton = React.forwardRef<HTMLButtonElement, ExpertChatButtonProps>(
  ({ clientId, clientName }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const bridgeOpen = useOracleVoiceBridge((s) => s.isOracleOpen);
    const pendingMessage = useOracleVoiceBridge((s) => s.pendingMessage);
    const closeOracle = useOracleVoiceBridge((s) => s.closeOracle);

    useEffect(() => {
      if (bridgeOpen && !isOpen) {
        setIsOpen(true);
      }
    }, [bridgeOpen, isOpen]);

    const handleClose = () => {
      setIsOpen(false);
      closeOracle();
    };

    return (
      <>
        <motion.button
          ref={ref}
          onClick={() => setIsOpen(true)}
          className="h-13 w-13 fixed bottom-20 right-4 z-40 flex items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary via-primary/80 to-primary/50 text-primary-foreground shadow-2xl backdrop-blur-sm sm:bottom-[6rem] sm:right-6 sm:h-14 sm:w-14"
          whileHover={{ scale: 1.08, rotate: 2 }}
          whileTap={{ scale: 0.92 }}
          aria-label="Abrir Flow - Assistente Pessoal (Ctrl+J)"
        >
          {/* Outer pulsing glow ring */}
          <motion.div
            className="absolute inset-0 rounded-2xl bg-primary/25"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Inner subtle ring */}
          <motion.div
            className="absolute inset-1 rounded-xl border border-primary-foreground/10"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <Bot className="relative z-10 h-5 w-5 drop-shadow-md sm:h-6 sm:w-6" />
          {/* Sparkle accent */}
          <motion.div
            className="absolute -right-1 -top-1"
            animate={{ rotate: [0, 20, -20, 0], scale: [0.7, 1.15, 0.7] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/30 backdrop-blur-sm">
              <Sparkles className="h-3 w-3 text-primary-foreground/90" />
            </div>
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <Suspense fallback={null}>
              <ExpertChatDialog
                isOpen={isOpen}
                onClose={handleClose}
                clientId={clientId}
                clientName={clientName}
                initialMessage={pendingMessage}
              />
            </Suspense>
          )}
        </AnimatePresence>
      </>
    );
  },
);
