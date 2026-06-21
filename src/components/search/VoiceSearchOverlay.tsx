import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { m as motion, AnimatePresence } from 'framer-motion';
import type { VoiceAgentAction, VoiceAgentPhase } from '@/hooks/intelligence';
import { usePhaseColors } from './voice/usePhaseColors';
import {
  playStartSound,
  playStopSound,
  playErrorSound,
  playProcessingSound,
  playSpeakingSound,
} from '@/hooks/voice/feedbackSounds';
import { SpectrumWaveform } from './voice/VoiceVisualEffects';
import { VoiceOrb } from './voice/VoiceOrb';
import { FloatingParticles } from './voice/FloatingParticles';
import { VoiceTranscriptPanel } from './voice/VoiceTranscriptPanel';
import { VoiceSuggestionsPanel } from './voice/VoiceSuggestionsPanel';
import type { VoiceHistoryEntry } from '@/hooks/voice/useVoiceHistory';

interface VoiceSearchOverlayProps {
  isOpen: boolean;
  phase: VoiceAgentPhase;
  partialTranscript: string;
  finalTranscript: string;
  agentResponse: string;
  error?: string | null;
  recentCommands?: VoiceHistoryEntry[];
  currentAction?: VoiceAgentAction | null;
  onClose: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  onCommandSelect?: (command: string) => void;
  onSimulateCommand?: (command: string) => void;
}

const PHASE_META: Record<VoiceAgentPhase, { title: string; subtitle: string; emoji: string }> = {
  idle: { title: 'Fale com o Flow', subtitle: 'Toque no orbe para começar', emoji: '✨' },
  listening: { title: 'Ouvindo…', subtitle: 'Diga o que você precisa', emoji: '🎙️' },
  processing: { title: 'Processando…', subtitle: 'IA interpretando seu comando', emoji: '⚡' },
  speaking: { title: 'Respondendo…', subtitle: 'Ouvindo a resposta', emoji: '💬' },
  error: { title: 'Erro', subtitle: 'Toque para tentar novamente', emoji: '⚠️' },
};

export const VoiceSearchOverlay = React.forwardRef<HTMLDivElement, VoiceSearchOverlayProps>(
  (
    {
      isOpen,
      phase,
      partialTranscript,
      finalTranscript,
      agentResponse,
      error,
      recentCommands,
      currentAction,
      onClose,
      onStartListening,
      onStopListening,
      onStopSpeaking,
      onCommandSelect,
      onSimulateCommand,
    },
    _ref,
  ) => {
    const [isAutoStarting, setIsAutoStarting] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [bootingTimedOut, setBootingTimedOut] = useState(false);
    const wasOpenRef = useRef(false);

    // Closing transition guard
    useEffect(() => {
      if (isOpen) {
        wasOpenRef.current = true;
        setIsClosing(false);
      } else if (wasOpenRef.current) {
        wasOpenRef.current = false;
        setIsClosing(true);
        const timer = setTimeout(() => setIsClosing(false), 300);
        return () => clearTimeout(timer);
      }
    }, [isOpen]);

    // Keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!isOpen) return;
        if (e.key === 'Escape') {
          onClose();
          return;
        }
        if (
          e.key === ' ' &&
          !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        ) {
          e.preventDefault();
          handleOrbClick();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, onClose]);

    // Auto-start & continuous listening
    const prevPhaseRef = useRef<VoiceAgentPhase>('idle');
    const hasAutoStarted = useRef(false);
    const startListeningRef = useRef(onStartListening);

    useEffect(() => {
      startListeningRef.current = onStartListening;
    }, [onStartListening]);

    useEffect(() => {
      if (!isOpen) {
        hasAutoStarted.current = false;
        prevPhaseRef.current = 'idle';
        setIsAutoStarting(false);
        return;
      }
      if (phase === 'idle' && !hasAutoStarted.current) {
        hasAutoStarted.current = true;
        setIsAutoStarting(true);
        const timer = window.setTimeout(() => startListeningRef.current(), 120);
        return () => clearTimeout(timer);
      }
      if (phase === 'idle' && prevPhaseRef.current === 'speaking') {
        setIsAutoStarting(true);
        const timer = window.setTimeout(() => startListeningRef.current(), 800);
        prevPhaseRef.current = phase;
        return () => clearTimeout(timer);
      }
      if (phase !== 'idle') {
        setIsAutoStarting(false);
        hasAutoStarted.current = true;
      }
      prevPhaseRef.current = phase;
    }, [isOpen, phase]);

    // Booting timeout
    useEffect(() => {
      if (!isOpen) {
        setBootingTimedOut(false);
        return;
      }
      const showsBooting = isAutoStarting && phase === 'idle';
      if (showsBooting) {
        const timer = setTimeout(() => setBootingTimedOut(true), 10000);
        return () => clearTimeout(timer);
      }
      setBootingTimedOut(false);
    }, [isOpen, isAutoStarting, phase]);

    const showBooting = (isAutoStarting && phase === 'idle') || isClosing;
    const meta = PHASE_META[phase] ?? PHASE_META.idle;
    const colors = usePhaseColors(phase, showBooting);
    const isWaveformActive = phase === 'listening' || phase === 'speaking' || showBooting;

    // Border glow
    const borderGlow = useMemo(() => {
      const match = /hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/.exec(colors.primary);
      const [h, s, l] = match ? [match[1], match[2], match[3]] : ['220', '80', '55'];
      return {
        border: `hsla(${h}, ${s}%, ${l}%, 0.35)`,
        shadowDim: `0 0 12px 1px hsla(${h}, ${s}%, ${l}%, 0.15), 0 0 30px 4px hsla(${h}, ${s}%, ${l}%, 0.08), inset 0 0 10px 0px hsla(${h}, ${s}%, ${l}%, 0.05)`,
        shadowBright: `0 0 25px 5px hsla(${h}, ${s}%, ${l}%, 0.35), 0 0 60px 10px hsla(${h}, ${s}%, ${l}%, 0.15), inset 0 0 18px 0px hsla(${h}, ${s}%, ${l}%, 0.1)`,
        borderDim: `hsla(${h}, ${s}%, ${l}%, 0.3)`,
        borderBright: `hsla(${h}, ${s}%, ${l}%, 0.7)`,
      };
    }, [colors.primary]);

    // Haptic feedback
    const vibrate = useCallback((pattern: number[] | number) => {
      try {
        navigator?.vibrate?.(pattern);
      } catch {
        /* unsupported */
      }
    }, []);

    const handleOrbClick = useCallback(() => {
      if (showBooting || phase === 'processing') return;
      vibrate(15);
      if (phase === 'listening') onStopListening();
      else if (phase === 'speaking') onStopSpeaking();
      else if (phase === 'idle' || phase === 'error') onStartListening();
    }, [phase, showBooting, vibrate, onStartListening, onStopListening, onStopSpeaking]);

    // Vibrate on phase transitions
    const prevVibratePhase = useRef(phase);
    useEffect(() => {
      if (phase !== prevVibratePhase.current) {
        if (phase === 'listening') {
          vibrate(10);
          playStartSound();
        } else if (phase === 'processing') {
          playProcessingSound();
        } else if (phase === 'speaking') {
          vibrate([10, 50, 10]);
          playSpeakingSound();
        } else if (phase === 'error') {
          vibrate([30, 80, 30]);
          playErrorSound();
        } else if (phase === 'idle' && prevVibratePhase.current === 'listening') {
          playStopSound();
        }
        prevVibratePhase.current = phase;
      }
    }, [phase, vibrate]);

    return createPortal(
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-label="Fale com o Flow"
          >
            {/* Glass backdrop */}
            <motion.div
              className="absolute inset-0 backdrop-blur-xl"
              animate={{
                backgroundColor: ['rgba(2,2,10,0.20)', 'rgba(2,2,10,0.65)', 'rgba(2,2,10,0.20)'],
              }}
              transition={{ duration: 6.6, repeat: Infinity, ease: 'easeInOut' }}
              onClick={onClose}
            />

            <FloatingParticles phase={phase} isBooting={showBooting} />

            {/* Centered card */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 30 }}
                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                className="pointer-events-auto relative w-full max-w-xs"
              >
                <motion.div
                  className="relative flex max-h-[90vh] w-full flex-col items-center gap-4 overflow-hidden rounded-3xl px-6 py-7"
                  style={{ background: 'rgba(8,8,18,0.95)' }}
                  animate={{
                    boxShadow: [
                      borderGlow.shadowDim,
                      borderGlow.shadowBright,
                      borderGlow.shadowDim,
                    ],
                    borderColor: [
                      borderGlow.borderDim,
                      borderGlow.borderBright,
                      borderGlow.borderDim,
                    ],
                    border: `1.5px solid ${borderGlow.border}`,
                  }}
                  transition={{
                    boxShadow: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
                    borderColor: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
                    border: { duration: 0.8, ease: 'easeInOut' },
                  }}
                >
                  {/* Title */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="space-y-1 text-center"
                  >
                    <h2 className="font-display text-sm font-semibold tracking-wide text-white/70">
                      {showBooting
                        ? bootingTimedOut
                          ? 'Microfone indisponível'
                          : 'Ativando microfone…'
                        : meta.title}
                    </h2>
                    <p className="text-[11px] tracking-wider text-white/30">
                      {showBooting
                        ? bootingTimedOut
                          ? 'Verifique as permissões do navegador'
                          : 'Preparando sua conversa por voz'
                        : meta.subtitle}
                    </p>
                  </motion.div>

                  {/* Clickable Orb */}
                  <motion.div
                    className="cursor-pointer select-none"
                    onClick={handleOrbClick}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    role="button"
                    aria-label={
                      showBooting
                        ? 'Ativando microfone'
                        : phase === 'listening'
                          ? 'Parar de ouvir'
                          : phase === 'processing'
                            ? 'Processando comando'
                            : phase === 'speaking'
                              ? 'Parar resposta'
                              : 'Iniciar microfone'
                    }
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleOrbClick();
                    }}
                  >
                    <VoiceOrb phase={phase} isBooting={showBooting} />
                  </motion.div>

                  {/* Spectrum waveform */}
                  <AnimatePresence mode="wait">
                    {isWaveformActive && (
                      <motion.div
                        key="spectrum"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <SpectrumWaveform
                          colors={colors}
                          isActive={isWaveformActive}
                          isSpeaking={phase === 'speaking'}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Transcript + Response + Error */}
                  <VoiceTranscriptPanel
                    phase={phase}
                    partialTranscript={partialTranscript}
                    finalTranscript={finalTranscript}
                    agentResponse={agentResponse}
                    error={error}
                    currentAction={currentAction}
                  />

                  {/* Suggestions + Text Input + Footer */}
                  <VoiceSuggestionsPanel
                    phase={phase}
                    isBooting={showBooting}
                    recentCommands={recentCommands}
                    onCommandSelect={onCommandSelect}
                    onSimulateCommand={onSimulateCommand}
                    onClose={onClose}
                  />
                </motion.div>
              </motion.div>
            </div>

            {/* Screen-reader live region */}
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {showBooting && 'Ativando microfone.'}
              {phase === 'listening' && 'Ouvindo. Fale seu comando.'}
              {phase === 'processing' && `Processando: ${finalTranscript}`}
              {phase === 'speaking' && `Resposta: ${agentResponse}`}
              {phase === 'error' && `Erro: ${error}`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
    );
  },
);
