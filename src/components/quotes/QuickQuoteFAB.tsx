import { useState, useEffect, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { m as motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Wand2, Calculator, ShoppingCart, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useOracleVoiceBridge } from '@/stores/oracleVoiceBridge';

const ExpertChatDialog = lazyWithRetry(() =>
  import('@/components/expert/ExpertChatDialog').then((m) => ({ default: m.ExpertChatDialog })),
);

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: typeof FileText;
  href: string;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'new-quote',
    label: 'Novo Orçamento',
    description: 'Criar orçamento do zero',
    icon: FileText,
    href: '/orcamentos/novo',
    color: 'bg-primary text-primary-foreground',
  },
  {
    id: 'mockup',
    label: 'Gerar Mockup',
    description: 'Visualização com logo',
    icon: Wand2,
    href: '/mockup-generator',
    color: 'bg-primary/80 text-primary-foreground',
  },
  {
    id: 'simulator',
    label: 'Simulador',
    description: 'Calcular personalização',
    icon: Calculator,
    href: '/simulador',
    color: 'bg-warning text-warning-foreground',
  },
  {
    id: 'cart',
    label: 'Carrinho',
    description: 'Orçamento rápido',
    icon: ShoppingCart,
    href: '__open_cart__',
    color: 'bg-primary/60 text-primary-foreground',
  },
  {
    id: 'expert',
    label: 'Flow',
    description: 'Assistente pessoal',
    icon: Bot,
    href: '__open_expert__',
    color: 'bg-accent text-accent-foreground',
  },
];

interface QuickQuoteFABProps {
  productId?: string;
  productName?: string;
}

const HIDDEN_FAB_PATHS = ['/orcamentos/novo', '/auth', '/mockup-generator'];

export function QuickQuoteFAB({ productId, productName: _productName }: QuickQuoteFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expertOpen, setExpertOpen] = useState(false);
  const [voiceInitialMessage, setVoiceInitialMessage] = useState<string | undefined>();
  const navigate = useNavigate();
  const location = useLocation();
  const bridgeOpen = useOracleVoiceBridge((s) => s.isOracleOpen);
  const pendingMessage = useOracleVoiceBridge((s) => s.pendingMessage);
  const closeOracle = useOracleVoiceBridge((s) => s.closeOracle);

  // React to voice bridge opening the oracle
  useEffect(() => {
    if (bridgeOpen && !expertOpen) {
      setVoiceInitialMessage(pendingMessage || undefined);
      setExpertOpen(true);
    }
  }, [bridgeOpen, expertOpen, pendingMessage]);

  // Don't show on certain pages
  if (HIDDEN_FAB_PATHS.some((path) => location.pathname.startsWith(path))) {
    return null;
  }

  const handleAction = (href: string) => {
    setIsOpen(false);

    if (href === '__open_cart__') {
      window.dispatchEvent(new CustomEvent('open-seller-cart'));
      return;
    }

    if (href === '__open_expert__') {
      setVoiceInitialMessage(undefined);
      setExpertOpen(true);
      return;
    }

    if (productId && href === '/orcamentos/novo') {
      navigate(`${href}?productId=${productId}`);
    } else if (productId && href === '/mockup-generator') {
      navigate(`${href}?productId=${productId}`);
    } else {
      navigate(href);
    }
  };

  return (
    <>
      <motion.div
        layout
        className="pointer-events-none fixed bottom-[140px] right-6 z-40 transition-all duration-300 sm:bottom-[160px] lg:bottom-[140px]"
      >
        <div className="pointer-events-auto">
          <AnimatePresence>
            {isOpen && (
              <motion.div
                key="fab-menu"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-background/40"
                  onClick={() => setIsOpen(false)}
                />

                {/* Quick Actions */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-16 right-0 flex flex-col items-end gap-3"
                >
                  {quickActions.map((action, index) => {
                    const Icon = action.icon;

                    return (
                      <motion.div
                        key={action.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center gap-3"
                      >
                        <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
                          <div className="whitespace-nowrap text-sm font-medium text-foreground">
                            {action.label}
                          </div>
                          <div className="text-xs text-muted-foreground">{action.description}</div>
                        </div>

                        <button
                          onClick={() => handleAction(action.href)}
                          className={cn(
                            'flex h-12 w-12 items-center justify-center rounded-full shadow-lg',
                            'transition-all duration-200 active:scale-95',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            action.color,
                          )}
                          aria-label={action.label}
                        >
                          <Icon className="h-5 w-5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main FAB */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                  'relative flex h-14 w-14 items-center justify-center rounded-full shadow-xl',
                  'transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isOpen
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
                aria-label={isOpen ? 'Fechar menu' : 'Ações rápidas'}
                aria-expanded={isOpen}
              >
                <motion.div animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
                  <Plus className="h-6 w-6" />
                </motion.div>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="left">Ações Rápidas</TooltipContent>
          </Tooltip>
        </div>
      </motion.div>

      {/* Expert Chat Dialog */}
      <Suspense fallback={null}>
        <ExpertChatDialog
          isOpen={expertOpen}
          onClose={() => {
            setExpertOpen(false);
            setVoiceInitialMessage(undefined);
            closeOracle();
          }}
          initialMessage={voiceInitialMessage}
        />
      </Suspense>
    </>
  );
}
