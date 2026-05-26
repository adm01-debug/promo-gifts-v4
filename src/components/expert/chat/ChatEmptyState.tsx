import { motion } from 'framer-motion';
import { Bot, Sparkles, History } from 'lucide-react';

interface ChatEmptyStateProps {
  sellerFirstName: string;
  clientId?: string;
  clientName?: string;
  conversationsCount: number;
  onAutoSend: (text: string) => void;
  onShowHistory: () => void;
}

export function ChatEmptyState({
  sellerFirstName,
  clientId,
  clientName,
  conversationsCount,
  onAutoSend,
  onShowHistory,
}: ChatEmptyStateProps) {
  const suggestions = clientId
    ? [
        {
          emoji: '📊',
          label: 'Resumo do cliente',
          prompt: `Me dê um resumo executivo completo deste cliente: histórico, ticket médio, preferências e oportunidades.`,
        },
        {
          emoji: '📝',
          label: 'Montar proposta',
          prompt:
            'Monte uma proposta personalizada com produtos ideais para este cliente, considerando seu perfil e histórico.',
        },
        {
          emoji: '📞',
          label: 'Follow-up',
          prompt:
            'Quais orçamentos estão pendentes? Sugira mensagens de follow-up para retomar contato com este cliente.',
        },
        {
          emoji: '🎯',
          label: 'Oportunidades',
          prompt:
            'Analise oportunidades de upsell e cross-sell para este cliente baseado no histórico de compras.',
        },
        {
          emoji: '🎨',
          label: 'Cores da marca',
          prompt: 'Produtos que combinam com as cores da marca deste cliente',
        },
        {
          emoji: '🎁',
          label: 'Datas comemorativas',
          prompt: 'Sugira produtos para as próximas datas comemorativas para este cliente',
        },
      ]
    : [
        {
          emoji: '✨',
          label: 'Recomendações',
          prompt: 'Quais produtos estão em alta e você recomenda para prospecção?',
        },
        {
          emoji: '📝',
          label: 'Montar proposta',
          prompt: 'Me ajude a montar uma proposta comercial. Qual é o perfil do cliente?',
        },
        {
          emoji: '📞',
          label: 'Dicas de follow-up',
          prompt: 'Me dê dicas de como fazer follow-up eficiente em orçamentos pendentes.',
        },
        {
          emoji: '🎯',
          label: 'Oportunidades sazonais',
          prompt: 'Quais são as melhores oportunidades de venda para este período do ano?',
        },
      ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
      className="flex flex-col items-center justify-center px-2 py-10"
    >
      <motion.div
        variants={{ hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1 } }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative mb-5"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/15 to-primary/5 shadow-lg shadow-primary/5">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <motion.div
          className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-lg border border-border/50 bg-background shadow-sm"
          animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Sparkles className="h-3 w-3 text-primary/70" />
        </motion.div>
      </motion.div>
      <motion.h3
        variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
        className="mb-1 font-display text-lg font-semibold tracking-tight"
      >
        {sellerFirstName ? `E aí, ${sellerFirstName}! 👋` : 'Olá! Sou o Flow'}
      </motion.h3>
      <motion.p
        variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
        className="max-w-[260px] text-center text-[13px] leading-relaxed text-muted-foreground/70"
      >
        {clientId
          ? `Seu assistente pessoal para vender mais para ${clientName || 'este cliente'}.`
          : 'Seu assistente pessoal de vendas. Produtos, propostas, follow-ups e oportunidades.'}
      </motion.p>
      <motion.div
        variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
        className="mt-5 flex flex-wrap justify-center gap-2"
      >
        {suggestions.map((item) => (
          <button
            key={item.label}
            onClick={() => onAutoSend(item.prompt)}
            className="group/chip flex items-center gap-1.5 rounded-xl border border-border/50 bg-background px-3.5 py-2 text-xs font-medium transition-all duration-200 hover:border-primary/30 hover:bg-primary/5"
          >
            <span>{item.emoji}</span>
            <span className="text-foreground/80 group-hover/chip:text-foreground">
              {item.label}
            </span>
          </button>
        ))}
      </motion.div>
      {conversationsCount > 0 && (
        <motion.button
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
          onClick={onShowHistory}
          className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground/50 transition-colors hover:text-primary"
        >
          <History className="h-3 w-3" /> Ver conversas anteriores ({conversationsCount})
        </motion.button>
      )}
    </motion.div>
  );
}
