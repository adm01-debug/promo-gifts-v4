import { useState, useEffect, useCallback, useRef } from 'react';

import { logger } from '@/lib/logger';
interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  language?: string;
}

interface SpeechRecognitionResult {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
}

const SPEECH_ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Permissao de microfone negada',
  'no-speech': 'Nenhuma fala detectada',
  'audio-capture': 'Nao foi possivel capturar audio',
  network: 'Erro de rede',
  aborted: 'Reconhecimento cancelado',
} as const;

export function useSpeechRecognition({
  onResult,
  onError,
  language = 'pt-BR',
}: UseSpeechRecognitionOptions = {}): SpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // BUG-VOICE-01 FIX: onResult e onError eram passados diretamente nas deps do useEffect.
  // Se o caller nao memoizar esses callbacks, o useEffect recria a instancia de
  // SpeechRecognition a cada render -- destruindo sessoes ativas e vazando listeners.
  // Solucao: capturar em refs para que os callbacks sejam sempre os mais recentes
  // sem triggerar recriacao da instancia.
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognitionAPI();

    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = language;

    recognitionInstance.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setTranscript(currentTranscript);

      if (finalTranscript) {
        // BUG-VOICE-01 FIX: chama via ref -- nao causa re-criacao da instancia
        onResultRef.current?.(finalTranscript.trim());
      }
    };

    recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
      const message = SPEECH_ERROR_MESSAGES[event.error] || `Erro: ${event.error}`;
      setError(message);
      // BUG-VOICE-01 FIX: chama via ref
      onErrorRef.current?.(message);
      setIsListening(false);
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
    };

    setRecognition(recognitionInstance);

    return () => {
      recognitionInstance.abort();
    };
    // BUG-VOICE-01 FIX: onResult e onError removidos das deps -- agora usam refs.
    // O efeito so recria a instancia quando isSupported ou language mudam.
  }, [isSupported, language]);

  const startListening = useCallback(() => {
    if (recognition && !isListening) {
      setTranscript('');
      setError(null);
      try {
        recognition.start();
      } catch (e) {
        // Recognition might already be started
        logger.error('Speech recognition error:', e);
      }
    }
  }, [recognition, isListening]);

  const stopListening = useCallback(() => {
    if (recognition && isListening) {
      recognition.stop();
    }
  }, [recognition, isListening]);

  return {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    error,
  };
}
