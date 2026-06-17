/**
 * VoiceTranscriptPanel — Displays live transcript and agent response in the voice overlay.
 */
import { m as motion, AnimatePresence } from 'framer-motion';
import { MicOff, Search, Filter, Navigation, ArrowUpDown, Trash2, HelpCircle } from 'lucide-react';
import type { VoiceAgentAction, VoiceAgentPhase } from '@/hooks/intelligence';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

const ACTION_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  search: { icon: () => null, label: 'Busca', color: 'text-primary' },
  filter: { icon: () => null, label: 'Filtro', color: 'text-accent-foreground' },
  navigate: { icon: () => null, label: 'Navegação', color: 'text-success' },
  sort: { icon: () => null, label: 'Ordenação', color: 'text-brand-primary' },
  clear: { icon: () => null, label: 'Limpar', color: 'text-destructive' },
  answer: { icon: () => null, label: 'Resposta', color: 'text-secondary-foreground' },
};

// Re-import real icons lazily to keep the file light
ACTION_META.search.icon = Search;
ACTION_META.filter.icon = Filter;
ACTION_META.navigate.icon = Navigation;
ACTION_META.sort.icon = ArrowUpDown;
ACTION_META.clear.icon = Trash2;
ACTION_META.answer.icon = HelpCircle;

interface VoiceTranscriptPanelProps {
  phase: VoiceAgentPhase;
  partialTranscript: string;
  finalTranscript: string;
  agentResponse: string;
  error?: string | null;
  currentAction?: VoiceAgentAction | null;
}

export function VoiceTranscriptPanel({
  phase,
  partialTranscript,
  finalTranscript,
  agentResponse,
  error,
  currentAction,
}: VoiceTranscriptPanelProps): ReactElement {
  const showTranscript = partialTranscript || finalTranscript;

  return (
    <>
      {/* Live transcript */}
      <AnimatePresence mode="wait">
        {showTranscript && (
          <motion.div
            key="transcript"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full"
          >
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.06] px-5 py-4 backdrop-blur-sm">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white/35">
                {phase === 'listening' ? '🎙️ Você está dizendo:' : '✅ Você disse:'}
              </p>
              <p className="font-display text-[15px] font-medium leading-relaxed text-white/90">
                "{partialTranscript || finalTranscript}"
                {phase === 'listening' && partialTranscript && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="ml-0.5 text-primary"
                  >
                    |
                  </motion.span>
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent response */}
      <AnimatePresence mode="wait">
        {agentResponse && (phase === 'speaking' || phase === 'idle') && (
          <motion.div
            key="agent-response"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="w-full"
          >
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.06] px-5 py-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                {(() => {
                  const actionType = currentAction?.action || 'answer';
                  const actionMeta = ACTION_META[actionType] || ACTION_META.answer;
                  const Icon = actionMeta.icon;
                  return (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 10, stiffness: 200 }}
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.08]"
                    >
                      <Icon className={cn('h-4 w-4', actionMeta.color)} />
                    </motion.div>
                  );
                })()}
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/35">
                      Assistente
                    </p>
                    {currentAction && currentAction.action !== 'answer' && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={cn(
                          'rounded-full border border-white/[0.1] bg-white/[0.06] px-2 py-0.5 text-[9px] font-medium',
                          ACTION_META[currentAction.action]?.color || 'text-white/50',
                        )}
                      >
                        {ACTION_META[currentAction.action]?.label}
                      </motion.span>
                    )}
                  </div>
                  <p className="font-display text-sm leading-relaxed text-white/90">
                    {agentResponse}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full rounded-2xl border border-destructive/20 bg-destructive/10 px-5 py-4"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/20">
                <MicOff className="h-3.5 w-3.5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-destructive">{error}</p>
                <p className="mt-1 text-xs text-white/40">Toque no orbe para tentar novamente</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
