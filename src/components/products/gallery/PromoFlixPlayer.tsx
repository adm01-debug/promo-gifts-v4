/**
 * PromoFlixPlayer — Reprodutor de vídeo estilo Netflix com:
 *  - Play/Pause, seek ±10s
 *  - Velocidades 0.5x / 1x / 1.25x / 1.5x / 2x
 *  - Volume + mute
 *  - Print/foto do frame atual (download PNG)
 *  - Picture-in-Picture e Fullscreen
 *  - Atalhos de teclado: Space, ←/→, J/L, K, ↑/↓, M, F, P, S, < / >
 *  - Suporte HLS via hls.js (fallback nativo no Safari)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import type HlsType from 'hls.js';
import {
  Camera,
  Gauge,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Zap,
  ZapOff,
  Info,
  X,
  Search,
  Target,
  ChevronRight,
  Settings,
  MessageCircle,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { VideoShareWhatsAppDialog } from './VideoShareWhatsAppDialog';
import { cn } from '@/lib/utils';
import { m as motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0
    ? `${h}:${mm}:${String(sec).padStart(2, '0')}`
    : `${mm}:${String(sec).padStart(2, '0')}`;
}

interface PromoFlixPlayerProps {
  src: string;
  posterUrl?: string | null;
  title?: string;
  productName?: string;
  isHls?: boolean;
  autoPlay?: boolean;
  className?: string;
  productId?: string | null;
  productPrice?: number | null;
  productSku?: string | null;
  productMinQuantity?: number | null;
  shareUrl?: string | null;
  /** Chamado quando o player esgota todas as tentativas e falha de forma irrecuperável.
   *  O componente pai pode usar isso para acionar um fallback (ex.: iframe YouTube/Vimeo). */
  onUnrecoverableError?: () => void;
}

export function PromoFlixPlayer({
  src,
  posterUrl,
  title,
  productName,
  isHls = false,
  autoPlay = true,
  className,
  productId: _productId,
  productPrice,
  productSku,
  productMinQuantity,
  shareUrl,
  onUnrecoverableError,
}: PromoFlixPlayerProps) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const canShareOnWhatsApp = Boolean(productName);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const hlsRef = useRef<HlsType | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(() => {
    try {
      const saved = localStorage.getItem('promoflix_volume');
      return saved !== null ? parseFloat(saved) : 1;
    } catch {
      return 1;
    }
  });
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem('promoflix_muted') === 'true';
    } catch {
      return false;
    }
  });
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [hlsError, setHlsError] = useState<string | null>(null);
  const [showLoadingAction, setShowLoadingAction] = useState(false);
  const [flashLabel, setFlashLabel] = useState<string | null>(null);
  const [isRaioXActive, setIsRaioXActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showRaioXPanel, setShowRaioXPanel] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState<number | null>(null);
  const [hoverSeekPct, setHoverSeekPct] = useState<number | null>(null);
  const [qualities, setQualities] = useState<{ id: number; label: string }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);

  const hotspots = useMemo(
    () => [
      {
        id: 1,
        x: 25,
        y: 35,
        label: 'Estrutura Principal',
        detail: 'Alumínio Escovado Premium',
        confidence: 98,
      },
      {
        id: 2,
        x: 65,
        y: 45,
        label: 'Lente de Precisão',
        detail: 'Cristal Safira Anti-Reflexo',
        confidence: 95,
      },
      {
        id: 3,
        x: 45,
        y: 75,
        label: 'Acabamento Base',
        detail: 'Polímero de Alta Densidade',
        confidence: 92,
      },
    ],
    [],
  );

  const logTelemetry = useCallback((event: string, details?: unknown) => {
    logger.debug(`[PromoFlix Telemetry] ${event}`, details);
  }, []);

  const flash = useCallback((label: string) => {
    setFlashLabel(label);
    window.setTimeout(() => setFlashLabel(null), 700);
  }, []);

  const reconnectAttemptsRef = useRef(0);
  const loadingTimeoutRef = useRef<number | null>(null);
  const initTokenRef = useRef(0);
  const autoplayFallbackTriedRef = useRef(false);
  const suppressMutePersistRef = useRef(false);
  // Guard: prevents native video onError from overwriting HLS error after destroy
  const hlsDestroyedRef = useRef(false);
  // Stable ref to the unrecoverable-error callback (avoids stale closures)
  const onUnrecoverableErrorRef = useRef(onUnrecoverableError);
  onUnrecoverableErrorRef.current = onUnrecoverableError;

  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current !== null) {
      window.clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  const armLoadingTimeout = useCallback(() => {
    clearLoadingTimeout();
    loadingTimeoutRef.current = window.setTimeout(() => {
      const v = videoRef.current;
      if (v && v.readyState < 1) {
        setShowLoadingAction(true);
        logTelemetry('STUCK_LOADING_TIMEOUT', {
          readyState: v.readyState,
          networkState: v.networkState,
          src: `${src.slice(0, 50)}...`,
          currentTime: v.currentTime,
        });
        loadingTimeoutRef.current = window.setTimeout(() => {
          const vv = videoRef.current;
          if (vv && vv.readyState < 1) {
            setHlsError(
              (prev) =>
                prev ??
                'O vídeo está demorando para responder. Pode haver um bloqueio de rede ou CORS.',
            );
            logTelemetry('LOADING_ERROR_FINAL', { readyState: vv.readyState });
          }
        }, 15000);
      } else {
        setIsLoading(false);
        setIsReconnecting(false);
      }
    }, 10000);
  }, [clearLoadingTimeout, logTelemetry, src]);

  const initPlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    const myToken = ++initTokenRef.current;
    autoplayFallbackTriedRef.current = false;
    hlsDestroyedRef.current = false;
    setIsLoading(true);
    setHlsError(null);
    setIsReconnecting(false);
    setShowLoadingAction(false);
    reconnectAttemptsRef.current = 0;
    logTelemetry('INIT_PLAYER', { src: `${src.slice(0, 50)}...`, isHls });
    armLoadingTimeout();
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {
        /* noop */
      }
      hlsRef.current = null;
    }
    try {
      video.removeAttribute('src');
      video.load();
    } catch {
      /* noop */
    }
    const shouldMuteForAutoplay = autoPlay && !isMuted;
    const effectiveMuted = isMuted || shouldMuteForAutoplay;
    suppressMutePersistRef.current = shouldMuteForAutoplay;
    const tryPlay = (v: HTMLVideoElement) => {
      v.play().catch((err) => {
        if (!autoplayFallbackTriedRef.current && !v.muted) {
          autoplayFallbackTriedRef.current = true;
          suppressMutePersistRef.current = true;
          v.muted = true;
          v.play().catch(() => setIsPlaying(false));
          logTelemetry('AUTOPLAY_FALLBACK_MUTED', { error: String(err) });
        } else {
          setIsPlaying(false);
        }
      });
    };
    const canPlayNativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== '';
    const isM3u8 =
      /\.m3u8(\?|$)/i.test(src) ||
      /\/manifest\/video\.m3u8/i.test(src) ||
      /cloudflarestream\.com.*manifest/i.test(src);
    const useNative = !isHls || !isM3u8 || canPlayNativeHls;
    if (useNative) {
      video.src = src;
      video.volume = volume;
      video.muted = effectiveMuted;
      try {
        video.load();
      } catch {
        /* noop */
      }
      if (isPlaying || autoPlay) {
        tryPlay(video);
      }
      return;
    }
    import('hls.js')
      .then(({ default: hlsConstructor }) => {
        if (myToken !== initTokenRef.current) return;
        const videoEl = videoRef.current;
        if (!videoEl) return;
        if (!hlsConstructor.isSupported()) {
          videoEl.src = src;
          videoEl.volume = volume;
          videoEl.muted = effectiveMuted;
          try {
            videoEl.load();
          } catch {
            /* noop */
          }
          if (isPlaying || autoPlay) tryPlay(videoEl);
          return;
        }
        if (hlsRef.current) {
          try {
            hlsRef.current.destroy();
          } catch {
            /* noop */
          }
        }
        const hlsInstance = new hlsConstructor({
          // Cloudflare Stream entrega VOD (não é live). lowLatencyMode mantém o buffer
          // mínimo perseguindo um "live edge" inexistente → travamento a cada jitter e
          // ABR preso em baixa qualidade. Para VOD precisa ser false.
          lowLatencyMode: false,
          enableWorker: true,
          // Buffer dianteiro saudável p/ absorver variação de rede sem rebuffer (anti-travamento).
          maxBufferLength: 60,
          maxMaxBufferLength: 600,
          maxBufferSize: 120 * 1000 * 1000,
          // Vídeos de produto são curtos: 30s de back-buffer p/ seek-back bastam e poupam memória.
          backBufferLength: 30,
          // ABR: iniciar já numa qualidade decente e subir rápido (anti "sem resolução").
          // Estimativa de cold-start calibrada medindo 100 manifestos reais (4 fornecedores):
          // 2 Mbps ⇒ 100% iniciam >=480p e ~76% >=720p; em rede lenta o testBandwidth do
          // hls.js mede o 1º fragmento e cai p/ o piso (~330p), então não trava no início.
          startLevel: -1,
          abrEwmaDefaultEstimate: 2_000_000,
          startFragPrefetch: true,
          // Nunca limitar a resolução ao tamanho do elemento (evita travar em baixa qualidade
          // quando o player monta pequeno antes de o modal/fullscreen expandir).
          capLevelToPlayerSize: false,
        });
        hlsRef.current = hlsInstance;
        hlsInstance.loadSource(src);
        hlsInstance.attachMedia(videoEl);
        hlsInstance.on(hlsConstructor.Events.MANIFEST_PARSED, (_, data) => {
          if (myToken !== initTokenRef.current) return;
          const levels = data.levels.map((level, index) => ({
            id: index,
            label: level.height ? `${level.height}p` : `Qualidade ${index + 1}`,
          }));
          setQualities(levels);
          try {
            // Restaura preferência PORTÁVEL por altura ("h:720") ou "auto". Mantém ABR
            // (currentLevel = -1) por padrão. Valores legados (índice cru) são ignorados,
            // o que também corrige o bug histórico de travar em baixa resolução entre vídeos.
            const savedQuality = localStorage.getItem('promoflix_quality');
            if (savedQuality?.startsWith('h:')) {
              const targetH = parseInt(savedQuality.slice(2), 10);
              if (Number.isFinite(targetH) && targetH > 0) {
                let bestIdx = -1;
                let bestDiff = Infinity;
                data.levels.forEach((lvl, idx) => {
                  if (!lvl.height) return;
                  const diff = Math.abs(lvl.height - targetH);
                  if (diff < bestDiff) {
                    bestDiff = diff;
                    bestIdx = idx;
                  }
                });
                if (bestIdx >= 0) {
                  hlsInstance.currentLevel = bestIdx;
                  setCurrentQuality(bestIdx);
                }
              }
            }
            // 'auto' / null / formato legado ⇒ não mexe: ABR ativo (currentLevel -1).
          } catch (err) {
            logger.warn('Falha ao carregar preferência de qualidade:', err);
          }
          const v = videoRef.current;
          if (v) {
            v.volume = volume;
            v.muted = effectiveMuted;
            if (isPlaying || autoPlay) tryPlay(v);
          }
          setIsLoading(false);
          setIsReconnecting(false);
          clearLoadingTimeout();
        });
        hlsInstance.on(hlsConstructor.Events.FRAG_LOADED, () => {
          if (myToken !== initTokenRef.current) return;
          setIsLoading(false);
          setIsReconnecting(false);
          clearLoadingTimeout();
        });
        hlsInstance.on(hlsConstructor.Events.ERROR, (_, data) => {
          if (myToken !== initTokenRef.current) return;
          if (!data.fatal) return;
          switch (data.type) {
            case hlsConstructor.ErrorTypes.NETWORK_ERROR: {
              logger.error('HLS Network Error:', data);
              reconnectAttemptsRef.current += 1;
              if (reconnectAttemptsRef.current > 3) {
                setHlsError(
                  'Não foi possível carregar o vídeo. Verifique sua conexão e tente novamente.',
                );
                setIsLoading(false);
                setIsReconnecting(false);
                clearLoadingTimeout();
                try {
                  hlsInstance.destroy();
                } catch {
                  /* noop */
                }
                hlsDestroyedRef.current = true;
                hlsRef.current = null;
                onUnrecoverableErrorRef.current?.();
              } else {
                setIsReconnecting(true);
                hlsInstance.startLoad();
              }
              break;
            }
            case hlsConstructor.ErrorTypes.MEDIA_ERROR:
              logger.error('HLS Media Error:', data);
              try {
                hlsInstance.recoverMediaError();
              } catch {
                setHlsError('Erro de mídia ao reproduzir o vídeo.');
                setIsLoading(false);
                clearLoadingTimeout();
                try {
                  hlsInstance.destroy();
                } catch {
                  /* noop */
                }
                hlsDestroyedRef.current = true;
                hlsRef.current = null;
                onUnrecoverableErrorRef.current?.();
              }
              break;
            case hlsConstructor.ErrorTypes.KEY_SYSTEM_ERROR:
            case hlsConstructor.ErrorTypes.MUX_ERROR:
            case hlsConstructor.ErrorTypes.OTHER_ERROR:
            default:
              logger.error('HLS Fatal Error:', data);
              setHlsError('Falha ao carregar o vídeo. Tente novamente.');
              setIsLoading(false);
              setIsReconnecting(false);
              clearLoadingTimeout();
              try {
                hlsInstance.destroy();
              } catch {
                /* noop */
              }
              hlsDestroyedRef.current = true;
              hlsRef.current = null;
              onUnrecoverableErrorRef.current?.();
              break;
          }
        });
        hlsInstance.on(hlsConstructor.Events.LEVEL_SWITCHED, () => {
          if (hlsInstance.autoLevelEnabled) {
            setCurrentQuality(-1);
          }
        });
      })
      .catch((err) => {
        if (myToken !== initTokenRef.current) return;
        logger.error('HLS loading error:', err);
        const v = videoRef.current;
        if (v) {
          v.src = src;
          v.volume = volume;
          v.muted = effectiveMuted;
          try {
            v.load();
          } catch {
            /* noop */
          }
          if (isPlaying || autoPlay) tryPlay(v);
        } else {
          setHlsError('Erro crítico no player.');
          setIsLoading(false);
          clearLoadingTimeout();
        }
      });
  }, [
    src,
    isHls,
    volume,
    isMuted,
    isPlaying,
    autoPlay,
    armLoadingTimeout,
    clearLoadingTimeout,
    logTelemetry,
  ]);

  useEffect(() => {
    initPlayer();
    const video = videoRef.current;
    return () => {
      initTokenRef.current += 1;
      clearLoadingTimeout();
      // FIX: clear controls hide timer on unmount to prevent state update on unmounted component
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {
          /* noop */
        }
        hlsRef.current = null;
      }
      if (video) {
        try {
          video.removeAttribute('src');
          video.load();
        } catch {
          /* noop */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, isHls]);

  const setQuality = useCallback(
    (index: number) => {
      const hls = hlsRef.current;
      if (!hls) return;
      hls.currentLevel = index;
      setCurrentQuality(index);
      const label =
        index === -1 ? 'Auto' : qualities.find((q) => q.id === index)?.label || 'Qualidade';
      // Persistir de forma PORTÁVEL entre vídeos: o índice de nível é por-manifesto, então
      // salvar o índice cru travava a resolução (às vezes a mais baixa) em vídeos seguintes.
      // Salvamos a ALTURA ("h:720") ou "auto".
      try {
        if (index === -1) {
          localStorage.setItem('promoflix_quality', 'auto');
        } else {
          const h = parseInt(label, 10);
          localStorage.setItem(
            'promoflix_quality',
            Number.isFinite(h) && h > 0 ? `h:${h}` : 'auto',
          );
        }
      } catch {
        /* noop */
      }
      flash(label);
    },
    [qualities, flash],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => {
      setIsPlaying(true);
      localStorage.setItem('promoflix_playing', 'true');
      logTelemetry('EVENT_PLAY');
    };
    const onPause = () => {
      setIsPlaying(false);
      localStorage.setItem('promoflix_playing', 'false');
      logTelemetry('EVENT_PAUSE');
    };
    const onTime = () => setCurrentTime(video.currentTime);
    const onMeta = () => {
      setDuration(video.duration || 0);
      setIsLoading(false);
      setHlsError(null);
      setShowLoadingAction(false);
      clearLoadingTimeout();
      logTelemetry('EVENT_LOADEDMETADATA', { duration: video.duration });
    };
    const onLoadStart = () => {
      logTelemetry('EVENT_LOADSTART');
    };
    const onLoadedData = () => {
      setIsLoading(false);
      setIsReconnecting(false);
      setShowLoadingAction(false);
      clearLoadingTimeout();
      logTelemetry('EVENT_LOADEDDATA');
    };
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
        setIsLoading(false);
        setShowLoadingAction(false);
        clearLoadingTimeout();
      }
    };
    const onWaiting = () => {
      if (video.readyState < 2) {
        setIsLoading(true);
        logTelemetry('EVENT_WAITING', { readyState: video.readyState });
      }
    };
    const onPlaying = () => {
      setIsLoading(false);
      setIsReconnecting(false);
      setShowLoadingAction(false);
      clearLoadingTimeout();
      logTelemetry('EVENT_PLAYING');
    };
    const onCanPlay = () => {
      setIsLoading(false);
      setIsReconnecting(false);
      setShowLoadingAction(false);
      clearLoadingTimeout();
      logTelemetry('EVENT_CANPLAY');
    };
    const onError = () => {
      const error = video.error;
      logTelemetry('EVENT_VIDEO_ERROR', {
        code: error?.code,
        message: error?.message,
        usingHls: Boolean(hlsRef.current),
        src: video.currentSrc?.slice(0, 80),
      });
      if (hlsRef.current) return;
      if (hlsDestroyedRef.current) return;
      if (!video.currentSrc && !video.src) return;
      switch (error?.code) {
        case 1:
          return;
        case 2:
          setHlsError(
            'Falha de rede ao carregar o vídeo. Verifique sua conexão e tente novamente.',
          );
          break;
        case 3:
          setHlsError(
            'Erro ao decodificar o vídeo. O arquivo pode estar corrompido ou em um codec não suportado.',
          );
          break;
        case undefined:
        case 4:
        default:
          setHlsError(
            'Não foi possível reproduzir este vídeo. O formato pode não ser suportado pelo seu navegador ou o link está indisponível.',
          );
          onUnrecoverableErrorRef.current?.();
          break;
      }
      setIsLoading(false);
      setShowLoadingAction(false);
      clearLoadingTimeout();
    };
    const onRate = () => setPlaybackRate(video.playbackRate);
    const onVolume = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
      localStorage.setItem('promoflix_volume', video.volume.toString());
      if (suppressMutePersistRef.current && video.muted) {
        suppressMutePersistRef.current = false;
      } else {
        suppressMutePersistRef.current = false;
        localStorage.setItem('promoflix_muted', video.muted.toString());
      }
    };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('loadstart', onLoadStart);
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('progress', onProgress);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);
    video.addEventListener('ratechange', onRate);
    video.addEventListener('volumechange', onVolume);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('loadstart', onLoadStart);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
      video.removeEventListener('ratechange', onRate);
      video.removeEventListener('volumechange', onVolume);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  }, []);
  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
      flash(delta > 0 ? `+${delta}s` : `${delta}s`);
    },
    [flash],
  );
  const setRate = useCallback(
    (rate: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.playbackRate = rate;
      flash(`${rate}x`);
    },
    [flash],
  );
  const stepRate = useCallback(
    (direction: 1 | -1) => {
      const v = videoRef.current;
      if (!v) return;
      const idx = PLAYBACK_RATES.indexOf(v.playbackRate as (typeof PLAYBACK_RATES)[number]);
      const baseIdx = idx === -1 ? PLAYBACK_RATES.indexOf(1) : idx;
      const next =
        PLAYBACK_RATES[Math.max(0, Math.min(PLAYBACK_RATES.length - 1, baseIdx + direction))];
      setRate(next);
    },
    [setRate],
  );
  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);
  const setVol = useCallback((value: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, value));
    if (v.volume > 0 && v.muted) v.muted = false;
  }, []);
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      el.requestFullscreen().catch(() => undefined);
    }
  }, []);
  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if ('requestPictureInPicture' in v) {
        await v.requestPictureInPicture();
      }
    } catch {
      toast.error('Picture-in-Picture indisponível neste vídeo');
    }
  }, []);

  const toggleRaioX = useCallback(() => {
    setIsRaioXActive((prev) => {
      const next = !prev;
      if (next) {
        flash('Raio-X ATIVADO');
        setIsAnalyzing(true);
        let progress = 0;
        const interval = window.setInterval(() => {
          progress += 5;
          if (progress >= 100) {
            window.clearInterval(interval);
            setIsAnalyzing(false);
            setShowRaioXPanel(true);
          }
        }, 80);
      } else {
        flash('Raio-X DESATIVADO');
        setShowRaioXPanel(false);
        setIsAnalyzing(false);
        setSelectedHotspot(null);
      }
      return next;
    });
  }, [flash]);

  const takeScreenshot = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth || 1280;
      canvas.height = v.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Não foi possível capturar o frame');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeName = (productName || title || 'promoflix').replace(/[^a-z0-9-_]+/gi, '-');
        a.href = url;
        a.download = `${safeName}-${Math.floor(v.currentTime)}s.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success('Frame salvo em PNG');
        flash('Foto');
      }, 'image/png');
    } catch {
      toast.error(
        'Captura bloqueada pelo navegador (CORS). Tente outro vídeo ou use a tecla PrintScreen.',
      );
    }
  }, [productName, title, flash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault();
          seekBy(-10);
          break;
        case 'ArrowRight':
        case 'l':
        case 'L':
          e.preventDefault();
          seekBy(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVol((videoRef.current?.volume ?? 1) + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVol((videoRef.current?.volume ?? 1) - 0.1);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          togglePip();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          takeScreenshot();
          break;
        case '>':
        case '.':
          e.preventDefault();
          stepRate(1);
          break;
        case '<':
        case ',':
          e.preventDefault();
          stepRate(-1);
          break;
        case 'x':
        case 'X':
          e.preventDefault();
          toggleRaioX();
          break;
        // no default
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    togglePlay,
    seekBy,
    setVol,
    toggleMute,
    toggleFullscreen,
    togglePip,
    takeScreenshot,
    stepRate,
    toggleRaioX,
  ]);

  const bumpControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2800);
  }, [isPlaying]);

  useEffect(() => bumpControls(), [bumpControls]);
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
    };
  }, []);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const next = (Number(e.target.value) / 100) * duration;
    v.currentTime = next;
  };
  const volumeIcon = useMemo(() => {
    if (isMuted || volume === 0) return <VolumeX className="h-5 w-5" />;
    return <Volume2 className="h-5 w-5" />;
  }, [isMuted, volume]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'group relative w-full overflow-hidden bg-black text-white',
        'aspect-video select-none',
        className,
      )}
      onMouseMove={bumpControls}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) togglePlay();
      }}
    >
      {/* crossOrigin removed: Cloudflare Stream doesn't return CORS headers for
          dynamic preview origins (id-preview--*.lovable.app), which blocked HLS
          manifest fetch. Without it, video plays fine. Screenshot (canvas) may
          produce tainted canvas — the catch block in takeScreenshot handles this. */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black"
        poster={posterUrl ?? undefined}
        autoPlay={autoPlay}
        playsInline
        preload="auto"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.45)_100%)]" />

      {(isLoading || isReconnecting) && !hlsError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/20 backdrop-blur-[2px]">
          <div className="relative h-14 w-14">
            <div className="absolute inset-0 rounded-full border-2 border-white/10" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-primary/60 border-t-primary" />
            <div className="absolute inset-2 flex items-center justify-center rounded-full bg-primary/10">
              <Play className="h-4 w-4 fill-primary text-primary" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">
              {isReconnecting ? 'Reconectando...' : 'Carregando'}
            </span>
            {showLoadingAction && (
              <motion.button
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  initPlayer();
                }}
                className="mt-2 flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/20"
              >
                <RotateCcw className="h-3 w-3" />
                Carregar Manualmente
              </motion.button>
            )}
          </div>
        </div>
      )}

      {hlsError && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/80 p-6 text-center backdrop-blur-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-red-500 ring-1 ring-red-500/40">
            <ZapOff className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold">Ops! Algo deu errado</h3>
            <p className="max-w-xs text-sm text-white/60">{hlsError}</p>
          </div>
          <Button
            onClick={() => initPlayer()}
            className="bg-primary px-8 font-bold text-primary-foreground hover:bg-primary/90"
          >
            Tentar Novamente
          </Button>
        </div>
      )}

      <AnimatePresence>
        {flashLabel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
          >
            <div className="rounded-full border border-white/10 bg-black/70 px-6 py-3 text-2xl font-bold tabular-nums shadow-2xl backdrop-blur-md">
              {flashLabel}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRaioXActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-20"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(var(--primary-rgb),0.1)_100%)] opacity-30" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
            {isAnalyzing && (
              <motion.div
                className="absolute left-0 z-30 h-1 w-full bg-primary/60 shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)]"
                initial={{ top: '0%' }}
                animate={{ top: '100%' }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            )}
            {!isAnalyzing &&
              hotspots.map((spot) => (
                <motion.button
                  key={spot.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: spot.id * 0.2 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedHotspot(spot.id);
                  }}
                  className={cn(
                    'pointer-events-auto absolute flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-xl transition-all hover:scale-125',
                    selectedHotspot === spot.id
                      ? 'z-40 scale-125 bg-primary'
                      : 'bg-primary/40 backdrop-blur-sm',
                  )}
                  style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                >
                  <div className="absolute h-10 w-10 animate-ping rounded-full bg-primary/20" />
                  <Target className="h-4 w-4 text-white" />
                </motion.button>
              ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRaioXPanel && isRaioXActive && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute bottom-0 right-0 top-0 z-40 flex w-52 flex-col border-l border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 fill-primary/20 text-primary" />
                <h3 className="font-display text-lg font-bold tracking-tight">RAIO-X</h3>
              </div>
              <button
                onClick={() => setShowRaioXPanel(false)}
                className="rounded-full p-1 transition-colors hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto pr-2">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                  Produto em Foco
                </p>
                <p className="text-sm font-medium">{productName || title || 'Identificando...'}</p>
              </div>
              {selectedHotspot ? (
                (() => {
                  const spot = hotspots.find((s) => s.id === selectedHotspot);
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={selectedHotspot}
                      className="space-y-4"
                    >
                      <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/10 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary">
                            Análise de Componente
                          </span>
                          <Badge
                            variant="outline"
                            className="border-primary/30 bg-primary/20 text-[9px] uppercase text-white"
                          >
                            {spot?.confidence}% Precisão
                          </Badge>
                        </div>
                        <p className="text-sm font-semibold">{spot?.label}</p>
                        <p className="text-xs leading-relaxed text-white/70">{spot?.detail}</p>
                      </div>
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-white/50">Materiais</span>
                          <span className="font-mono">AL+SI+CR</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                          <div className="h-full bg-primary" style={{ width: '85%' }} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })()
              ) : (
                <div className="flex h-48 flex-col items-center justify-center space-y-4 px-4 text-center opacity-60">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                    <Search className="h-6 w-6 text-white/40" />
                  </div>
                  <p className="text-xs text-white/60">
                    Selecione um ponto de interesse no vídeo para analisar
                  </p>
                </div>
              )}
            </div>
            <div className="border-t border-white/10 pt-6">
              <Button
                variant="outline"
                size="sm"
                className="group w-full gap-2 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white"
                onClick={() => toast.info('Integrando com Catálogo de Produtos...')}
              >
                <Info className="h-4 w-4" />
                Ver Detalhes Técnicos
                <ChevronRight className="ml-auto h-3 w-3 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isPlaying && !isLoading && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={togglePlay}
            className="group/play absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/10 via-transparent to-black/40"
            aria-label="Reproduzir"
          >
            <span className="relative flex h-24 w-24 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-primary/30 blur-2xl transition-all group-hover/play:bg-primary/50" />
              <span className="absolute inset-0 scale-110 rounded-full border border-white/20 transition-transform duration-500 group-hover/play:scale-125" />
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/95 text-black shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover/play:scale-110">
                <Play className="ml-1 h-9 w-9 fill-current" />
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/70 via-black/30 to-transparent px-5 py-4 transition-all duration-500',
          showControls || !isPlaying ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
        )}
      >
        <div className="flex items-center gap-3">
          <div className="relative overflow-hidden rounded-md bg-gradient-to-br from-primary to-primary/70 px-2.5 py-1 shadow-lg shadow-primary/30 ring-1 ring-white/20">
            <span className="relative z-10 text-[11px] font-black uppercase tracking-[0.25em] text-primary-foreground">
              PromoFlix
            </span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
            />
          </div>
          {title && (
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                Você está assistindo
              </span>
              <span className="max-w-[420px] truncate text-sm font-semibold tracking-tight text-white drop-shadow-md">
                {title}
              </span>
            </div>
          )}
        </div>
        {isRaioXActive && (
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/20 px-3 py-1.5 shadow-lg shadow-primary/20 backdrop-blur-md">
              <Zap className="h-3.5 w-3.5 animate-pulse fill-primary/40 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                Modo Raio-X
              </span>
            </div>
          </div>
        )}
      </div>

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-4 pt-12 transition-all duration-500 md:px-5 md:pb-4 md:pt-12',
          showControls || !isPlaying ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        )}
      >
        <div
          className="group/seek relative mb-2 flex items-center py-3 md:mb-3 md:py-2"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = ((e.clientX - rect.left) / rect.width) * 100;
            setHoverSeekPct(Math.max(0, Math.min(100, pct)));
          }}
          onMouseLeave={() => setHoverSeekPct(null)}
        >
          {hoverSeekPct !== null && duration > 0 && (
            <div
              className="pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2 py-1 text-[11px] font-bold tabular-nums text-white shadow-xl backdrop-blur-md"
              style={{ left: `${hoverSeekPct}%` }}
            >
              {formatTime((hoverSeekPct / 100) * duration)}
              <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90" />
            </div>
          )}
          <div className="relative h-1.5 w-full rounded-full bg-white/20 transition-all duration-200 md:h-1 md:group-hover/seek:h-1.5">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/30"
              style={{ width: `${bufferedPct}%` }}
            />
            {hoverSeekPct !== null && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/15"
                style={{ width: `${hoverSeekPct}%` }}
              />
            )}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/80 shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]"
              style={{ width: `${progressPct}%` }}
            />
            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.6)] ring-2 ring-primary transition-opacity md:h-3.5 md:w-3.5 md:opacity-0 md:group-hover/seek:opacity-100"
              style={{ left: `${progressPct}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progressPct}
            onChange={onSeek}
            aria-label="Linha do tempo"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 md:flex-nowrap">
          <div className="flex items-center gap-1">
            <button
              onClick={togglePlay}
              className="rounded-full p-3 transition-all hover:scale-110 hover:bg-white/15 active:scale-95 md:p-2"
              aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
            >
              {isPlaying ? (
                <Pause className="h-6 w-6 fill-current md:h-5 md:w-5" />
              ) : (
                <Play className="h-6 w-6 fill-current md:h-5 md:w-5" />
              )}
            </button>
            <button
              onClick={() => seekBy(-10)}
              className="rounded-full p-3 transition-all hover:-rotate-12 hover:bg-white/15 active:scale-95 md:p-2"
              aria-label="Voltar 10 segundos"
              title="Voltar 10s (J / ←)"
            >
              <RotateCcw className="h-6 w-6 md:h-5 md:w-5" />
            </button>
            <button
              onClick={() => seekBy(10)}
              className="rounded-full p-3 transition-all hover:rotate-12 hover:bg-white/15 active:scale-95 md:p-2"
              aria-label="Avançar 10 segundos"
              title="Avançar 10s (L / →)"
            >
              <RotateCw className="h-6 w-6 md:h-5 md:w-5" />
            </button>
            <div className="group/vol hidden items-center sm:flex">
              <button
                onClick={toggleMute}
                className="rounded-full p-2 transition-all hover:scale-110 hover:bg-white/15 active:scale-95"
                aria-label={isMuted ? 'Ativar som' : 'Mutar'}
              >
                {volumeIcon}
              </button>
              <div className="overflow-hidden">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVol(Number(e.target.value))}
                  aria-label="Volume"
                  className="w-0 cursor-pointer accent-primary transition-all duration-300 md:group-hover/vol:ml-2 md:group-hover/vol:w-24"
                />
              </div>
            </div>
            <div className="ml-2 flex items-baseline gap-1 font-mono text-sm tabular-nums md:ml-3 md:gap-1.5 md:text-[13px]">
              <span className="font-semibold text-white">{formatTime(currentTime)}</span>
              <span className="text-white/30">/</span>
              <span className="text-white/50">{formatTime(duration)}</span>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1 md:gap-1.5">
            <div className="mr-1 flex items-center gap-1 border-r border-white/10 px-1 md:mr-2 md:gap-1.5 md:px-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleRaioX}
                    className={cn(
                      'group relative flex items-center justify-center rounded-full p-3 transition-all duration-300 md:p-2',
                      isRaioXActive
                        ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]'
                        : 'text-white/80 hover:bg-white/15 hover:text-white',
                    )}
                    aria-label="Ativar Raio-X"
                  >
                    {isRaioXActive ? (
                      <Zap className="h-6 w-6 fill-current md:h-5 md:w-5" />
                    ) : (
                      <ZapOff className="h-6 w-6 md:h-5 md:w-5" />
                    )}
                    {isRaioXActive && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 md:-right-1 md:-top-1">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-white"></span>
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Raio-X (X)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={takeScreenshot}
                    className="flex items-center gap-1 rounded-full p-3 text-white/80 transition-colors hover:bg-white/15 hover:text-white md:p-2"
                    aria-label="Capturar frame"
                  >
                    <Camera className="h-6 w-6 md:h-5 md:w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Foto do frame (S)</TooltipContent>
              </Tooltip>
              {canShareOnWhatsApp && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShareDialogOpen(true);
                      }}
                      className="flex items-center gap-1 rounded-full p-3 text-white/80 transition-colors hover:bg-[#25D366]/20 hover:text-[#25D366] md:p-2"
                      aria-label="Enviar vídeo pelo WhatsApp"
                    >
                      <MessageCircle className="h-6 w-6 md:h-5 md:w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Enviar vídeo pelo WhatsApp</TooltipContent>
                </Tooltip>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-1 rounded-full px-3 py-3 text-sm font-medium tabular-nums transition-colors hover:bg-white/15 md:px-2.5 md:py-2"
                      aria-label="Velocidade"
                    >
                      <Gauge className="h-6 w-6 md:h-5 md:w-5" />
                      <span className="hidden sm:inline">{playbackRate}x</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuLabel>Velocidade</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {PLAYBACK_RATES.map((rate) => (
                      <DropdownMenuItem
                        key={rate}
                        onClick={() => setRate(rate)}
                        className={cn(playbackRate === rate && 'font-bold text-primary', 'py-2.5')}
                      >
                        {rate === 1 ? 'Normal (1x)' : `${rate}x`}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent side="top">Velocidade (&lt; / &gt;)</TooltipContent>
            </Tooltip>
            {qualities.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-1 rounded-full px-3 py-3 text-sm font-medium transition-colors hover:bg-white/15 md:px-2.5 md:py-2"
                    aria-label="Qualidade"
                    title="Qualidade do Vídeo"
                  >
                    <Settings className="h-6 w-6 md:h-5 md:w-5" />
                    <span className="hidden sm:inline">
                      {currentQuality === -1
                        ? 'Auto'
                        : qualities.find((q) => q.id === currentQuality)?.label}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuLabel>Qualidade</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setQuality(-1)}
                    className={cn(currentQuality === -1 && 'font-bold text-primary', 'py-2.5')}
                  >
                    Auto
                  </DropdownMenuItem>
                  {qualities.map((q) => (
                    <DropdownMenuItem
                      key={q.id}
                      onClick={() => setQuality(q.id)}
                      className={cn(currentQuality === q.id && 'font-bold text-primary', 'py-2.5')}
                    >
                      {q.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              onClick={togglePip}
              className="hidden rounded-full p-3 transition-colors hover:bg-white/15 sm:flex md:p-2"
              aria-label="Picture-in-Picture"
              title="Picture-in-Picture (P)"
            >
              <PictureInPicture2 className="h-6 w-6 md:h-5 md:w-5" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="rounded-full p-3 transition-colors hover:bg-white/15 md:p-2"
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              title="Tela cheia (F)"
            >
              {isFullscreen ? (
                <Minimize className="h-6 w-6 md:h-5 md:w-5" />
              ) : (
                <Maximize className="h-6 w-6 md:h-5 md:w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {canShareOnWhatsApp && (
        <VideoShareWhatsAppDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          productName={productName ?? ''}
          videoTitle={title}
          shareUrl={shareUrl}
          productPrice={productPrice}
          productSku={productSku}
          productMinQuantity={productMinQuantity}
        />
      )}
    </div>
  );
}
