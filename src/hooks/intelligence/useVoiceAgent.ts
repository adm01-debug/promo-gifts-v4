import { useState, useCallback, useRef, useEffect } from 'react';
import { useScribe, CommitStrategy } from '@elevenlabs/react';

import { playTtsAudio } from '@/hooks/voice/playTtsAudio';
import { processVoiceTranscript } from '@/hooks/voice/processTranscript';
import { getScribeToken, invalidateScribeTokenCache } from '@/hooks/voice/scribeTokenCache';
import { withRetry, friendlyErrorMessage } from '@/hooks/voice/retry';
import { logVoiceCommand } from '@/hooks/voice/logVoiceCommand';
import {
  startWebSpeech,
  stopWebSpeech,
  isWebSpeechSupported,
  isWebSpeechActive,
} from '@/hooks/voice/webSpeechFallback';
import type { VoiceAgentAction, VoiceAgentPhase, UseVoiceAgentOptions } from '@/hooks/voice/types';
import { logger } from '@/lib/logger';

export type { VoiceAgentAction, VoiceAgentPhase } from '@/hooks/voice/types';

const ERROR_RESET_DELAY_MS = 5000;
const PROCESSING_ERROR_RESET_DELAY_MS = 3000;
const SESSION_START_TIMEOUT_MS = 4000; // Reduced for faster fallback

export function useVoiceAgent({ onAction, onError }: UseVoiceAgentOptions = {}) {
  // === Stable refs for callbacks to avoid dependency churn ===
  const onActionRef = useRef(onAction);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const [phase, setPhase] = useState<VoiceAgentPhase>('idle');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentAction, setCurrentAction] = useState<VoiceAgentAction | null>(null);

  const stopSpeakingRef = useRef<(() => void) | null>(null);
  const isProcessingRef = useRef(false);
  const isStartingRef = useRef(false);
  const usingFallbackRef = useRef(false);
  const resetPhaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectScribeRef = useRef<() => void>(() => undefined);

  const clearResetPhaseTimer = useCallback(() => {
    if (resetPhaseTimerRef.current !== null) {
      clearTimeout(resetPhaseTimerRef.current);
      resetPhaseTimerRef.current = null;
    }
  }, []);

  const clearSessionStartTimer = useCallback(() => {
    if (sessionStartTimerRef.current !== null) {
      clearTimeout(sessionStartTimerRef.current);
      sessionStartTimerRef.current = null;
    }
  }, []);

  const scheduleIdleReset = useCallback(
    (delay = ERROR_RESET_DELAY_MS) => {
      clearResetPhaseTimer();
      resetPhaseTimerRef.current = setTimeout(() => {
        resetPhaseTimerRef.current = null;
        setPhase('idle');
        setError(null);
      }, delay);
    },
    [clearResetPhaseTimer],
  );

  const forceDisconnectScribe = useCallback(() => {
    clearSessionStartTimer();
    try {
      disconnectScribeRef.current();
    } catch (disconnectError) {
      logger.warn('[Voice] Failed to disconnect Scribe:', disconnectError);
    }
  }, [clearSessionStartTimer]);

  // === useScribe MUST be called unconditionally ===
  const handleScribeErrorRef = useRef<(err: unknown) => void>(() => undefined);

  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    commitStrategy: CommitStrategy.VAD,
    onConnect: () => {
      logger.log('[Voice] Scribe socket connected');
    },
    onSessionStarted: () => {
      logger.log('[Voice] Scribe session started');
      isStartingRef.current = false;
      usingFallbackRef.current = false;
      clearResetPhaseTimer();
      clearSessionStartTimer();
      setError(null);
      setPhase('listening');
    },
    onDisconnect: () => {
      logger.log('[Voice] Scribe disconnected');
      isStartingRef.current = false;
      clearSessionStartTimer();
      setPartialTranscript('');
      setPhase((current) =>
        (['processing', 'speaking', 'error'] as string[]).includes(current) ? current : 'idle',
      );
    },
    onError: (err: unknown) => handleScribeErrorRef.current(err),
    onPartialTranscript: (data: { text: string }) => {
      setPartialTranscript(data.text);
    },
    onCommittedTranscript: (data: { text: string }) => {
      if (data.text.trim()) {
        setPartialTranscript('');
        processTranscriptRef.current(data.text.trim());
      }
    },
  });

  disconnectScribeRef.current = () => scribe.disconnect();

  // === Callbacks ===

  const processTranscriptRef = useRef<(text: string) => void>(() => undefined);

  const processTranscript = useCallback(
    async (text: string) => {
      if (isProcessingRef.current || !text.trim()) return;

      clearResetPhaseTimer();
      isProcessingRef.current = true;
      setPhase('processing');
      setFinalTranscript(text);
      setAgentResponse('');
      const startTime = Date.now();

      try {
        const action = await withRetry(() => processVoiceTranscript(text));
        setCurrentAction(action);
        setAgentResponse(action.response);

        if (action.response) {
          setPhase('speaking');
          const { promise, stop } = playTtsAudio(action.response);
          stopSpeakingRef.current = stop;
          await promise.catch((ttsErr) => {
            logger.warn('[VoiceAgent] TTS playback failed:', ttsErr);
          });
          stopSpeakingRef.current = null;
        }

        logVoiceCommand(action, {
          transcript: text,
          durationMs: Date.now() - startTime,
          success: true,
        });

        setPhase('idle');
        onActionRef.current?.(action);
      } catch (err) {
        const message = friendlyErrorMessage(err);
        setError(message);
        setPhase('error');
        onErrorRef.current?.(message);

        logVoiceCommand(
          { action: 'answer', response: message, data: {} },
          {
            transcript: text,
            durationMs: Date.now() - startTime,
            success: false,
          },
        );

        scheduleIdleReset(PROCESSING_ERROR_RESET_DELAY_MS);
      } finally {
        isProcessingRef.current = false;
      }
    },
    [clearResetPhaseTimer, scheduleIdleReset],
  );

  useEffect(() => {
    processTranscriptRef.current = processTranscript;
  }, [processTranscript]);

  // === Fallback: start Web Speech API ===
  const startFallbackSTT = useCallback(() => {
    if (!isWebSpeechSupported()) {
      logger.warn('[Voice] Web Speech API not supported, no fallback available');
      return false;
    }

    logger.log('[Voice] Starting Web Speech API fallback...');
    usingFallbackRef.current = true;

    return startWebSpeech({
      onSessionStarted: () => {
        logger.log('[Voice] Web Speech fallback session started');
        isStartingRef.current = false;
        clearResetPhaseTimer();
        clearSessionStartTimer();
        setError(null);
        setPhase('listening');
      },
      onPartialTranscript: (text) => {
        setPartialTranscript(text);
      },
      onCommittedTranscript: (text) => {
        if (text.trim()) {
          setPartialTranscript('');
          processTranscriptRef.current(text.trim());
        }
      },
      onError: (err) => {
        logger.error('[Voice] Web Speech fallback error:', err);
        isStartingRef.current = false;
        const message = friendlyErrorMessage(err);
        setError(message);
        setPhase('error');
        onErrorRef.current?.(message);
        scheduleIdleReset();
      },
      onDisconnect: () => {
        logger.log('[Voice] Web Speech fallback disconnected');
        isStartingRef.current = false;
        usingFallbackRef.current = false;
        setPartialTranscript('');
        setPhase((current) =>
          (['processing', 'speaking', 'error'] as string[]).includes(current) ? current : 'idle',
        );
      },
    });
  }, [clearResetPhaseTimer, clearSessionStartTimer, scheduleIdleReset]);

  // === Handle Scribe errors - try fallback ===
  const handleScribeError = useCallback(
    (_err: unknown) => {
      // Invalidate cached token since connection failed
      invalidateScribeTokenCache();
      // Only log at debug level - this is expected when ElevenLabs is unavailable.
      logger.log('[Voice] Scribe unavailable, switching to browser speech recognition...');
      isStartingRef.current = false;
      clearResetPhaseTimer();
      clearSessionStartTimer();
      forceDisconnectScribe();
      setPartialTranscript('');

      // Immediately try Web Speech API fallback - no error state shown to user.
      const fallbackStarted = startFallbackSTT();
      if (fallbackStarted) {
        isStartingRef.current = true;
        // Don't set error - the user doesn't need to know about the internal switch.
        setError(null);
        setPhase('idle'); // Will transition to listening when fallback starts
        return;
      }

      // No fallback available - show error.
      const message = 'Reconhecimento de voz não disponível neste navegador.';
      setError(message);
      setPhase('error');
      onErrorRef.current?.(message);
      scheduleIdleReset();
    },
    [
      clearResetPhaseTimer,
      clearSessionStartTimer,
      forceDisconnectScribe,
      scheduleIdleReset,
      startFallbackSTT,
    ],
  );

  useEffect(() => {
    handleScribeErrorRef.current = handleScribeError;
  }, [handleScribeError]);

  // === Request microphone permission explicitly ===
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop all tracks immediately - we just needed permission.
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (err) {
      logger.warn('[Voice] Microphone permission denied:', err);
      return false;
    }
  }, []);

  const startListening = useCallback(async () => {
    const scribeStatus = scribe.status ?? 'disconnected';
    if (isStartingRef.current || scribeStatus === 'connecting') return;

    clearResetPhaseTimer();
    clearSessionStartTimer();

    // Disconnect any existing connections
    if (scribeStatus !== 'disconnected' || scribe.isConnected) {
      forceDisconnectScribe();
    }
    if (isWebSpeechActive()) {
      stopWebSpeech();
    }

    isStartingRef.current = true;
    usingFallbackRef.current = false;
    setError(null);
    setPartialTranscript('');
    setFinalTranscript('');
    setAgentResponse('');
    setCurrentAction(null);
    setPhase('idle');

    // 1. Request microphone permission first
    const hasMic = await requestMicPermission();
    if (!hasMic) {
      isStartingRef.current = false;
      const message =
        'Permissão do microfone negada. Habilite o microfone nas configurações do navegador.';
      setError(message);
      setPhase('error');
      onErrorRef.current?.(message);
      scheduleIdleReset();
      return;
    }

    // 2. Try ElevenLabs Scribe first
    try {
      const token = await getScribeToken();
      logger.log('[Voice] Token obtained, connecting to Scribe...');

      sessionStartTimerRef.current = setTimeout(() => {
        if (!isStartingRef.current) return;
        // Timeout -> try fallback.
        handleScribeError(new Error('Scribe session start timeout'));
      }, SESSION_START_TIMEOUT_MS);

      await scribe.connect({
        token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      logger.log('[Voice] Scribe connection initiated');
      // If Scribe fails, onError -> handleScribeError -> fallback kicks in automatically.
    } catch (err) {
      logger.log('[Voice] Scribe connection failed, trying fallback...');
      clearSessionStartTimer();
      forceDisconnectScribe();

      // 3. Fallback to Web Speech API
      const fallbackStarted = startFallbackSTT();
      if (!fallbackStarted) {
        isStartingRef.current = false;
        const message = friendlyErrorMessage(err);
        setError(message);
        setPhase('error');
        onErrorRef.current?.(message);
        scheduleIdleReset();
      }
    }
  }, [
    clearResetPhaseTimer,
    clearSessionStartTimer,
    forceDisconnectScribe,
    handleScribeError,
    requestMicPermission,
    scheduleIdleReset,
    scribe,
    startFallbackSTT,
  ]);

  const stopListening = useCallback(() => {
    isStartingRef.current = false;
    clearResetPhaseTimer();
    clearSessionStartTimer();

    if (usingFallbackRef.current) {
      stopWebSpeech();
    } else {
      scribe.disconnect();
    }

    if (phase === 'listening') {
      if (partialTranscript.trim()) {
        processTranscript(partialTranscript.trim());
      } else {
        setPhase('idle');
      }
    } else if (phase !== 'processing' && phase !== 'speaking') {
      setPhase('idle');
    }
  }, [
    clearResetPhaseTimer,
    clearSessionStartTimer,
    partialTranscript,
    phase,
    processTranscript,
    scribe,
  ]);

  const stopSpeaking = useCallback(() => {
    clearResetPhaseTimer();
    stopSpeakingRef.current?.();
    stopSpeakingRef.current = null;
    setPhase('idle');
  }, [clearResetPhaseTimer]);

  const reset = useCallback(() => {
    isStartingRef.current = false;
    usingFallbackRef.current = false;
    clearResetPhaseTimer();
    clearSessionStartTimer();
    scribe.disconnect();
    stopWebSpeech();
    stopSpeakingRef.current?.();
    stopSpeakingRef.current = null;
    setPhase('idle');
    setPartialTranscript('');
    setFinalTranscript('');
    setAgentResponse('');
    setError(null);
    setCurrentAction(null);
    isProcessingRef.current = false;
  }, [clearResetPhaseTimer, clearSessionStartTimer, scribe]);

  useEffect(() => {
    return () => {
      clearResetPhaseTimer();
      clearSessionStartTimer();
      try {
        disconnectScribeRef.current();
      } catch {
        /* empty */
      }
      stopWebSpeech();
      stopSpeakingRef.current?.();
      stopSpeakingRef.current = null;
    };
  }, [clearResetPhaseTimer, clearSessionStartTimer]);

  /** Simulate a voice command from text input (no mic needed) */
  const simulateCommand = useCallback((text: string) => {
    if (!text.trim() || isProcessingRef.current) return;
    processTranscriptRef.current(text.trim());
  }, []);

  return {
    phase,
    partialTranscript,
    finalTranscript,
    agentResponse,
    error,
    currentAction,
    isConnected: scribe.isConnected || isWebSpeechActive(),
    startListening,
    stopListening,
    stopSpeaking,
    reset,
    simulateCommand,
  };
}
