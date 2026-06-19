/**
 * playTtsAudio — Fetches TTS audio from the edge function and plays it.
 * Returns a promise that resolves when audio finishes or rejects on error.
 * Includes user auth token for authenticated edge functions.
 */
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';

function createSilentWavUrl(durationMs = 120) {
  const sampleRate = 8000;
  const channelCount = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
  const dataSize = sampleCount * channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

export function playTtsAudio(
  text: string,
  options?: { onStart?: () => void },
): {
  promise: Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
} {
  let audio: HTMLAudioElement | null = new Audio();
  let objectUrl: string | null = null;
  let primingUrl: string | null = null;
  let paused = false;
  let stopped = false;

  audio.preload = 'auto';
  audio.setAttribute('playsinline', 'true');

  const clearPrimingUrl = () => {
    if (!primingUrl) return;
    if (audio?.src === primingUrl) {
      audio.removeAttribute('src');
      audio.load();
    }
    URL.revokeObjectURL(primingUrl);
    primingUrl = null;
  };

  const primingPromise = (() => {
    if (!audio) return Promise.resolve();

    try {
      primingUrl = createSilentWavUrl();
      audio.src = primingUrl;

      return Promise.resolve(audio.play())
        .then(() => {
          if (!audio) return;
          audio.pause();
          audio.currentTime = 0;
          clearPrimingUrl();
        })
        .catch(() => {
          clearPrimingUrl();
        });
    } catch {
      clearPrimingUrl();
      return Promise.resolve();
    }
  })();

  const promise = (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (stopped) return;

    const authToken = session?.access_token || SUPABASE_PUBLISHABLE_KEY;

    const maxLen = 800;
    const ttsText =
      text.length > maxLen ? `${text.slice(0, maxLen).replace(/\s+\S*$/, '')}...` : text;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    let ttsResponse: Response;
    try {
      ttsResponse = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ text: ttsText }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!ttsResponse.ok) {
      const errBody = await ttsResponse.text().catch(() => '');
      throw new Error(`TTS failed: ${ttsResponse.status} - ${errBody}`);
    }

    const blob = await ttsResponse.blob();
    if (blob.size === 0) {
      throw new Error('Empty audio response');
    }

    await primingPromise;
    if (stopped) return;

    objectUrl = URL.createObjectURL(blob);

    if (!audio) {
      audio = new Audio();
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
    }

    audio.src = objectUrl;
    audio.currentTime = 0;
    audio.load();

    return new Promise<void>((resolve, reject) => {
      const activeAudio = audio;
      if (!activeAudio) {
        cleanup();
        resolve();
        return;
      }

      activeAudio.onended = () => {
        cleanup();
        resolve();
      };

      activeAudio.onerror = () => {
        cleanup();
        reject(new Error('Audio playback error'));
      };

      Promise.resolve(activeAudio.play())
        .then(() => {
          options?.onStart?.();
        })
        .catch((err) => {
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  })();

  function cleanup() {
    clearPrimingUrl();
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    audio = null;
    paused = false;
  }

  function stop() {
    stopped = true;
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
    }
    cleanup();
  }

  function pause() {
    if (audio && !audio.paused) {
      audio.pause();
      paused = true;
    }
  }

  function resume() {
    if (audio?.paused && paused) {
      audio.play().catch(() => {});
      paused = false;
    }
  }

  function isPaused() {
    return paused;
  }

  return { promise, stop, pause, resume, isPaused };
}
