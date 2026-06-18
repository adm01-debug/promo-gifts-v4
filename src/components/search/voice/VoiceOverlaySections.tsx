/**
 * Extracted sections from VoiceSearchOverlay — suggestions, text input, footer
 */
import { useRef, useState } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Send, Keyboard, X } from 'lucide-react';
import type { VoiceAgentPhase } from '@/hooks/intelligence';
import type { VoiceHistoryEntry } from '@/hooks/voice/useVoiceHistory';

const SUGGESTION_COMMANDS = [
  'Quero canetas azuis baratas',
  'Mostra mochilas ecológicas',
  'Pergunte ao Flow qual o melhor brinde',
  'Abre os orçamentos',
];

interface SuggestionsProps {
  phase: VoiceAgentPhase;
  showBooting: boolean;
  recentCommands?: VoiceHistoryEntry[];
  onCommandSelect?: (command: string) => void;
}

export function VoiceSuggestions({
  phase,
  showBooting,
  recentCommands,
  onCommandSelect,
}: SuggestionsProps) {
  if (phase !== 'idle' || showBooting) return null;

  return (
    <motion.div
      initial={{ y: 15, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.25 }}
      className="w-full space-y-3 text-center"
    >
      {recentCommands?.length ? (
        <>
          <p className="text-[10px] font-medium uppercase tracking-widest text-white/25">
            Comandos recentes
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {recentCommands.slice(0, 4).map((entry) => (
              <button
                key={entry.timestamp}
                onClick={() => onCommandSelect?.(entry.transcript)}
                className="group cursor-pointer rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-xs text-white/35 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.08] hover:text-white/70 hover:shadow-[0_0_12px_rgba(255,255,255,0.05)]"
              >
                <span className="transition-all duration-200 group-hover:tracking-wide">
                  "{entry.transcript}"
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-[10px] font-medium uppercase tracking-widest text-white/25">
            Experimente dizer
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTION_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                onClick={() => onCommandSelect?.(cmd)}
                className="group cursor-pointer rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-xs text-white/35 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.08] hover:text-white/70 hover:shadow-[0_0_12px_rgba(255,255,255,0.05)]"
              >
                <span className="transition-all duration-200 group-hover:tracking-wide">
                  "{cmd}"
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

interface TextInputProps {
  phase: VoiceAgentPhase;
  onSimulateCommand?: (command: string) => void;
}

export function VoiceTextInput({ phase, onSimulateCommand }: TextInputProps) {
  const [showTextInput, setShowTextInput] = useState(false);
  const [textCommand, setTextCommand] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <AnimatePresence>
        {showTextInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full overflow-hidden"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (textCommand.trim() && onSimulateCommand) {
                  onSimulateCommand(textCommand.trim());
                  setTextCommand('');
                  setShowTextInput(false);
                }
              }}
              className="flex gap-2"
            >
              <input
                ref={textInputRef}
                type="text"
                value={textCommand}
                onChange={(e) => setTextCommand(e.target.value)}
                placeholder="Digite um comando..."
                className="flex-1 rounded-xl border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-white/25 focus:outline-none focus:ring-1 focus:ring-white/10"
                autoFocus
                disabled={phase === 'processing' || phase === 'speaking'}
              />
              <button
                type="submit"
                disabled={!textCommand.trim() || phase === 'processing' || phase === 'speaking'}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/20 text-primary transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <VoiceFooter
        showTextInput={showTextInput}
        onToggleTextInput={() => {
          setShowTextInput((v) => !v);
          if (!showTextInput) setTimeout(() => textInputRef.current?.focus(), 100);
        }}
      />
    </>
  );
}

function VoiceFooter({
  showTextInput: _showTextInput,
  onToggleTextInput: _onToggleTextInput,
  onClose: _onClose,
}: {
  showTextInput: boolean;
  onToggleTextInput: () => void;
  onClose?: () => void;
}) {
  return null; // Footer is rendered inline in VoiceSearchOverlay
}

interface FooterProps {
  onClose: () => void;
  onToggleTextInput: () => void;
}

export function VoiceOverlayFooter({ onClose, onToggleTextInput }: FooterProps) {
  return (
    <div className="mt-1 flex w-full items-center justify-between">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-[10px] text-white/20"
      >
        <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[9px]">
          ESC
        </kbd>{' '}
        fechar
        <span className="mx-1.5 text-white/10">·</span>
        <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[9px]">
          SPACE
        </kbd>{' '}
        ativar
      </motion.p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggleTextInput}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
          aria-label="Digitar comando"
          title="Digitar comando (sem microfone)"
        >
          <Keyboard className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
          aria-label="Fechar assistente de voz"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
