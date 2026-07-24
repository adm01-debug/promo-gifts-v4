/**
 * Web Speech API fallback for when ElevenLabs Scribe is unavailable.
 * Provides browser-native speech recognition as a reliable fallback.
 */
import { logger } from '@/lib/logger';

// Extend Window to include webkit prefixed SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

export interface WebSpeechCallbacks {
  onSessionStarted: () => void;
  onPartialTranscript: (text: string) => void;
  onCommittedTranscript: (text: string) => void;
  onError: (error: Error) => void;
  onDisconnect: () => void;
}

let recognition: SpeechRecognition | null = null;

export function isWebSpeechSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startWebSpeech(callbacks: WebSpeechCallbacks): boolean {
  const SpeechRecognitionClass = (window.SpeechRecognition ||
    window.webkitSpeechRecognition) as unknown as SpeechRecognitionConstructor | undefined;

  if (!SpeechRecognitionClass) {
    callbacks.onError(new Error('Web Speech API não suportada neste navegador.'));
    return false;
  }

  // Stop any existing instance
  stopWebSpeech();

  try {
    recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';
    recognition.maxAlternatives = 1;

    let finalTranscriptBuffer = '';
    let commitTimer: ReturnType<typeof setTimeout> | null = null;

    recognition.onstart = () => {
      logger.log('[Voice] Web Speech API started (fallback)');
      callbacks.onSessionStarted();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalText += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        callbacks.onPartialTranscript(interimTranscript);
      }

      if (finalText) {
        finalTranscriptBuffer += finalText;
        // Debounce commit to aggregate rapid final results
        if (commitTimer) clearTimeout(commitTimer);
        commitTimer = setTimeout(() => {
          if (finalTranscriptBuffer.trim()) {
            callbacks.onCommittedTranscript(finalTranscriptBuffer.trim());
            finalTranscriptBuffer = '';
          }
        }, 600);
      }
    };

    recognition.onerror = (event: Event & { error: string }) => {
      logger.warn('[Voice] Web Speech error:', event.error);
      if (event.error === 'no-speech') {
        // Not critical — user just didn't speak
        return;
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        callbacks.onError(new Error('Permissão do microfone negada.'));
      } else if (event.error === 'network') {
        callbacks.onError(new Error('Erro de rede no reconhecimento de voz.'));
      } else {
        callbacks.onError(new Error(`Erro de reconhecimento: ${event.error}`));
      }
    };

    recognition.onend = () => {
      // Commit any remaining text
      if (finalTranscriptBuffer.trim()) {
        if (commitTimer) clearTimeout(commitTimer);
        callbacks.onCommittedTranscript(finalTranscriptBuffer.trim());
        finalTranscriptBuffer = '';
      }
      logger.log('[Voice] Web Speech API ended');
      callbacks.onDisconnect();
      recognition = null;
    };

    recognition.start();
    return true;
  } catch (err) {
    logger.error('[Voice] Failed to start Web Speech:', err);
    callbacks.onError(
      err instanceof Error ? err : new Error('Falha ao iniciar reconhecimento de voz.'),
    );
    recognition = null;
    return false;
  }
}

export function stopWebSpeech(): void {
  if (recognition) {
    try {
      recognition.stop();
    } catch {
      // Already stopped
    }
    recognition = null;
  }
}

export function isWebSpeechActive(): boolean {
  return recognition !== null;
}
