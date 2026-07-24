/**
 * useExpertChatTts — TTS playback logic extracted from useExpertChat
 */
import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { playTtsAudio } from '@/hooks/voice/playTtsAudio';

export function useExpertChatTts() {
  const [playingTtsId, setPlayingTtsId] = useState<string | null>(null);
  const [pausedTtsId, setPausedTtsId] = useState<string | null>(null);
  const [loadingTtsId, setLoadingTtsId] = useState<string | null>(null);
  const [ttsErrorId, setTtsErrorId] = useState<string | null>(null);
  const ttsStopRef = useRef<(() => void) | null>(null);
  const ttsPauseRef = useRef<(() => void) | null>(null);
  const ttsResumeRef = useRef<(() => void) | null>(null);

  const handlePlayTts = useCallback(
    async (messageId: string, text: string) => {
      if (pausedTtsId === messageId && ttsResumeRef.current) {
        ttsResumeRef.current();
        setPausedTtsId(null);
        setPlayingTtsId(messageId);
        return;
      }
      if (ttsStopRef.current) {
        ttsStopRef.current();
        ttsStopRef.current = null;
        ttsPauseRef.current = null;
        ttsResumeRef.current = null;
        if (playingTtsId === messageId) {
          setPlayingTtsId(null);
          setPausedTtsId(null);
          return;
        }
      }
      setPausedTtsId(null);
      setLoadingTtsId(messageId);
      setTtsErrorId(null);
      try {
        const { promise, stop, pause, resume } = playTtsAudio(text, {
          onStart: () => {
            setLoadingTtsId(null);
            setPlayingTtsId(messageId);
          },
        });
        ttsStopRef.current = stop;
        ttsPauseRef.current = pause;
        ttsResumeRef.current = resume;
        await promise;
      } catch {
        setTtsErrorId(messageId);
        toast.error('Não foi possível reproduzir o áudio', {
          description: 'O navegador bloqueou a reprodução. Toque novamente para tentar.',
        });
      } finally {
        setPlayingTtsId(null);
        setPausedTtsId(null);
        setLoadingTtsId(null);
        ttsStopRef.current = null;
        ttsPauseRef.current = null;
        ttsResumeRef.current = null;
      }
    },
    [playingTtsId, pausedTtsId],
  );

  const handlePauseTts = useCallback(
    (messageId: string) => {
      if (ttsPauseRef.current && playingTtsId === messageId) {
        ttsPauseRef.current();
        setPlayingTtsId(null);
        setPausedTtsId(messageId);
      }
    },
    [playingTtsId],
  );

  const stopTts = useCallback(() => {
    if (ttsStopRef.current) {
      ttsStopRef.current();
      ttsStopRef.current = null;
      ttsPauseRef.current = null;
      ttsResumeRef.current = null;
    }
    setPlayingTtsId(null);
    setPausedTtsId(null);
  }, []);

  return {
    playingTtsId,
    pausedTtsId,
    loadingTtsId,
    ttsErrorId,
    handlePlayTts,
    handlePauseTts,
    stopTts,
  };
}
