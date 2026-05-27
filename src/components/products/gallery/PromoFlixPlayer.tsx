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
  ChevronLeft,
  Settings,
  MessageCircle
} from 'lucide-react';
import { VideoShareWhatsAppDialog } from './VideoShareWhatsAppDialog';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
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
  /** Dados de venda — habilitam botão "Enviar pelo WhatsApp" */
  productId?: string | null;
  productPrice?: number | null;
  productSku?: string | null;
  productMinQuantity?: number | null;
  /** URL pública que o cliente vai abrir (página do produto) */
  shareUrl?: string | null;
}

export function PromoFlixPlayer({
  src,
  posterUrl,
  title,
  productName,
  isHls = false,
  autoPlay = true,
  className,
  productId,
  productPrice,
  productSku,
  productMinQuantity,
  shareUrl,
}: PromoFlixPlayerProps) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const canShareOnWhatsApp = Boolean(productName);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const hlsRef = useRef<import('hls.js').default | null>(null);

  const [isPlaying, setIsPlaying] = useState(() => {
    try {
      return localStorage.getItem('promoflix_playing') === 'true';
    } catch {
      return false;
    }
  });
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
  const [flashLabel, setFlashLabel] = useState<string | null>(null);
  const [isRaioXActive, setIsRaioXActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [showRaioXPanel, setShowRaioXPanel] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState<number | null>(null);
  const [hoverSeekPct, setHoverSeekPct] = useState<number | null>(null);
  const [qualities, setQualities] = useState<{ id: number, label: string }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto

  // Mock hotspots based on video aspect ratio (for visual simulation)
  const hotspots = useMemo(() => [
    { id: 1, x: 25, y: 35, label: 'Estrutura Principal', detail: 'Alumínio Escovado Premium', confidence: 98 },
    { id: 2, x: 65, y: 45, label: 'Lente de Precisão', detail: 'Cristal Safira Anti-Reflexo', confidence: 95 },
    { id: 3, x: 45, y: 75, label: 'Acabamento Base', detail: 'Polímero de Alta Densidade', confidence: 92 },
  ], []);

  const flash = useCallback((label: string) => {
    setFlashLabel(label);
    window.setTimeout(() => setFlashLabel(null), 700);
  }, []);

  // Setup HLS or native
  const initPlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setIsLoading(true);
    setHlsError(null);
    setIsReconnecting(false);

    const useNative =
      !isHls ||
      video.canPlayType('application/vnd.apple.mpegurl') !== '' ||
      !src.endsWith('.m3u8');

    if (useNative) {
      video.src = src;
      // Initialize with saved volume
      video.volume = volume;
      video.muted = isMuted;
      if (isPlaying || autoPlay) {
        video.play().catch(() => setIsPlaying(false));
      }
    } else {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (!videoRef.current) return;
          if (Hls.isSupported()) {
            if (hlsRef.current) {
              hlsRef.current.destroy();
            }
            const hlsInstance = new Hls({ 
              maxBufferLength: 30,
              enableWorker: true,
              lowLatencyMode: true,
              backBufferLength: 90
            });
            hlsRef.current = hlsInstance;
            hlsInstance.loadSource(src);
            hlsInstance.attachMedia(videoRef.current);

            hlsInstance.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
              const levels = data.levels.map((level, index) => ({
                id: index,
                label: level.height ? `${level.height}p` : `Qualidade ${index + 1}`
              }));
              setQualities(levels);
              
              try {
                const savedQuality = localStorage.getItem('promoflix_quality');
                if (savedQuality !== null && hlsInstance) {
                  const q = parseInt(savedQuality, 10);
                  if (!isNaN(q) && q >= -1 && q < data.levels.length) {
                    hlsInstance.currentLevel = q;
                    setCurrentQuality(q);
                  }
                }
              } catch (err) {
                console.warn('Falha ao carregar preferência de qualidade:', err);
              }

              // Apply saved volume/mute
              if (videoRef.current) {
                videoRef.current.volume = volume;
                videoRef.current.muted = isMuted;
                if (isPlaying || autoPlay) {
                  videoRef.current.play().catch(() => setIsPlaying(false));
                }
              }
            });

            hlsInstance.on(Hls.Events.ERROR, (_, data) => {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.error('HLS Network Error:', data);
                    setIsReconnecting(true);
                    hlsInstance.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.error('HLS Media Error:', data);
                    hlsInstance.recoverMediaError();
                    break;
                  default:
                    console.error('HLS Fatal Error:', data);
                    setHlsError('Falha ao carregar o vídeo. Verifique sua conexão.');
                    hlsInstance.destroy();
                    break;
                }
              }
            });

            hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
              if (hlsInstance && hlsInstance.autoLevelEnabled) {
                setCurrentQuality(-1);
              }
            });
          } else if (videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
            videoRef.current.src = src;
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
          }
        })
        .catch((err) => {
          console.error('HLS loading error:', err);
          setHlsError('Erro crítico no player.');
          if (videoRef.current) videoRef.current.src = src;
        });
    }
  }, [src, isHls, volume, isMuted, isPlaying, autoPlay]);

  useEffect(() => {
    initPlayer();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, isHls]); // Only re-init on src change to avoid loop with persistence states

  const setQuality = useCallback((index: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = index;
    setCurrentQuality(index);
    localStorage.setItem('promoflix_quality', index.toString());
    const label = index === -1 ? 'Auto' : qualities.find(q => q.id === index)?.label || 'Qualidade';
    flash(label);
  }, [qualities, flash]);

  // Bind video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setIsPlaying(true);
      localStorage.setItem('promoflix_playing', 'true');
    };
    const onPause = () => {
      setIsPlaying(false);
      localStorage.setItem('promoflix_playing', 'false');
    };
    const onTime = () => setCurrentTime(video.currentTime);
    const onMeta = () => {
      setDuration(video.duration || 0);
      setIsLoading(false);
      setHlsError(null);
    };
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => {
      setIsLoading(false);
      setIsReconnecting(false);
    };
    const onRate = () => setPlaybackRate(video.playbackRate);
    const onVolume = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
      localStorage.setItem('promoflix_volume', video.volume.toString());
      localStorage.setItem('promoflix_muted', video.muted.toString());
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('progress', onProgress);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('ratechange', onRate);
    video.addEventListener('volumechange', onVolume);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('ratechange', onRate);
      video.removeEventListener('volumechange', onVolume);
    };
  }, []);

  // Fullscreen tracking
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
      v.currentTime = Math.max(0, Math.min((v.duration || 0), v.currentTime + delta));
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
      const next = PLAYBACK_RATES[
        Math.max(0, Math.min(PLAYBACK_RATES.length - 1, baseIdx + direction))
      ];
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
    setIsRaioXActive(prev => {
      const next = !prev;
      if (next) {
        flash('Raio-X ATIVADO');
        // Simulate initial scan
        setIsAnalyzing(true);
        setScanProgress(0);
        const interval = window.setInterval(() => {
          setScanProgress(p => {
            if (p >= 100) {
              window.clearInterval(interval);
              setIsAnalyzing(false);
              setShowRaioXPanel(true);
              return 100;
            }
            return p + 5;
          });
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

  // Keyboard shortcuts
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

  // Auto-hide controls
  const bumpControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2800);
  }, [isPlaying]);

  useEffect(() => bumpControls(), [bumpControls]);

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
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black"
        poster={posterUrl ?? undefined}
        autoPlay={autoPlay}
        playsInline
        crossOrigin="anonymous"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* Cinematic vignette for legibility */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.45)_100%)]" />

      {/* Loading state — branded */}
      {(isLoading || isReconnecting) && !hlsError && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 z-20">
          <div className="relative h-14 w-14">
            <div className="absolute inset-0 rounded-full border-2 border-white/10" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary/60" />
            <div className="absolute inset-2 rounded-full bg-primary/10 backdrop-blur-sm flex items-center justify-center">
              <Play className="h-4 w-4 fill-primary text-primary" />
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">
            {isReconnecting ? 'Reconectando...' : 'Carregando'}
          </span>
        </div>
      )}

      {/* Error state */}
      {hlsError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/80 backdrop-blur-sm z-50 p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-red-500 ring-1 ring-red-500/40">
            <ZapOff className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold">Ops! Algo deu errado</h3>
            <p className="max-w-xs text-sm text-white/60">{hlsError}</p>
          </div>
          <Button 
            onClick={() => initPlayer()} 
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8"
          >
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Flash feedback */}
      <AnimatePresence>
        {flashLabel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center z-50"
          >
            <div className="rounded-full bg-black/70 px-6 py-3 text-2xl font-bold tabular-nums backdrop-blur-md border border-white/10 shadow-2xl">
              {flashLabel}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Raio-X Analysis Overlay */}
      <AnimatePresence>
        {isRaioXActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 pointer-events-none"
          >
            {/* Analysis Grid Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(var(--primary-rgb),0.1)_100%)] opacity-30" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
            
            {/* Scanning Line */}
            {isAnalyzing && (
              <motion.div
                className="absolute left-0 w-full h-1 bg-primary/60 shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)] z-30"
                initial={{ top: '0%' }}
                animate={{ top: '100%' }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            )}

            {/* Hotspots */}
            {!isAnalyzing && hotspots.map((spot) => (
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
                  "pointer-events-auto absolute flex items-center justify-center h-8 w-8 rounded-full border-2 border-white shadow-xl transition-all hover:scale-125",
                  selectedHotspot === spot.id ? "bg-primary scale-125 z-40" : "bg-primary/40 backdrop-blur-sm"
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

      {/* Raio-X Side Panel (Glassmorphism) */}
      <AnimatePresence>
        {showRaioXPanel && isRaioXActive && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute right-0 top-0 bottom-0 w-72 z-40 flex flex-col bg-black/40 backdrop-blur-xl border-l border-white/10 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary fill-primary/20" />
                <h3 className="font-display font-bold text-lg tracking-tight">RAIO-X</h3>
              </div>
              <button 
                onClick={() => setShowRaioXPanel(false)}
                className="rounded-full p-1 hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto pr-2">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Produto em Foco</p>
                <p className="text-sm font-medium">{productName || title || 'Identificando...'}</p>
              </div>

              {selectedHotspot ? (
                (() => {
                  const spot = hotspots.find(s => s.id === selectedHotspot);
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={selectedHotspot}
                      className="space-y-4"
                    >
                      <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary">Análise de Componente</span>
                          <Badge variant="outline" className="text-[9px] bg-primary/20 border-primary/30 text-white uppercase">{spot?.confidence}% Precisão</Badge>
                        </div>
                        <p className="text-sm font-semibold">{spot?.label}</p>
                        <p className="text-xs text-white/70 leading-relaxed">{spot?.detail}</p>
                      </div>
                      
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-white/50">Materiais</span>
                          <span className="font-mono">AL+SI+CR</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: '85%' }} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })()
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center space-y-4 px-4 opacity-60">
                  <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center">
                    <Search className="h-6 w-6 text-white/40" />
                  </div>
                  <p className="text-xs text-white/60">Selecione um ponto de interesse no vídeo para analisar</p>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-white/10">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full bg-white/5 border-white/10 hover:bg-white/10 hover:text-white gap-2 group"
                onClick={() => toast.info('Integrando com Catálogo de Produtos...')}
              >
                <Info className="h-4 w-4" />
                Ver Detalhes Técnicos
                <ChevronRight className="h-3 w-3 ml-auto transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center play overlay — cinematic */}
      <AnimatePresence>
        {!isPlaying && !isLoading && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/10 via-transparent to-black/40 group/play"
            aria-label="Reproduzir"
          >
            <span className="relative flex h-24 w-24 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-primary/30 blur-2xl group-hover/play:bg-primary/50 transition-all" />
              <span className="absolute inset-0 rounded-full border border-white/20 scale-110 group-hover/play:scale-125 transition-transform duration-500" />
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/95 text-black shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover/play:scale-110">
                <Play className="h-9 w-9 fill-current ml-1" />
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Top bar: brand + title */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/70 via-black/30 to-transparent px-5 py-4 transition-all duration-500',
          showControls || !isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
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
              transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
            />
          </div>
          {title && (
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Você está assistindo</span>
              <span className="text-sm font-semibold text-white drop-shadow-md tracking-tight max-w-[420px] truncate">{title}</span>
            </div>
          )}
        </div>

        {isRaioXActive && (
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center gap-2 bg-primary/20 backdrop-blur-md border border-primary/40 rounded-full px-3 py-1.5 shadow-lg shadow-primary/20">
              <Zap className="h-3.5 w-3.5 text-primary animate-pulse fill-primary/40" />
              <span className="text-[10px] font-black text-white tracking-[0.2em] uppercase">Modo Raio-X</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-4 pt-12 transition-all duration-500 md:px-5 md:pb-4 md:pt-12',
          showControls || !isPlaying ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        )}
      >
        {/* Seek bar with larger touch area on mobile */}
        <div
          className="group/seek relative mb-2 flex items-center py-3 md:mb-3 md:py-2"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = ((e.clientX - rect.left) / rect.width) * 100;
            setHoverSeekPct(Math.max(0, Math.min(100, pct)));
          }}
          onMouseLeave={() => setHoverSeekPct(null)}
        >
          {/* Hover time tooltip - hidden on touch devices by default behavior */}
          {hoverSeekPct !== null && duration > 0 && (
            <div
              className="pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full rounded-md bg-black/90 px-2 py-1 text-[11px] font-bold tabular-nums text-white border border-white/10 shadow-xl backdrop-blur-md whitespace-nowrap"
              style={{ left: `${hoverSeekPct}%` }}
            >
              {formatTime((hoverSeekPct / 100) * duration)}
              <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90" />
            </div>
          )}

          <div className="relative h-1.5 w-full rounded-full bg-white/20 transition-all duration-200 md:h-1 md:group-hover/seek:h-1.5">
            {/* Buffered */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/30"
              style={{ width: `${bufferedPct}%` }}
            />
            {/* Hover ghost */}
            {hoverSeekPct !== null && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/15"
                style={{ width: `${hoverSeekPct}%` }}
              />
            )}
            {/* Progress */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/80 shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]"
              style={{ width: `${progressPct}%` }}
            />
            {/* Thumb - Larger on mobile */}
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
              className="rounded-full p-3 transition-all hover:bg-white/15 hover:scale-110 active:scale-95 md:p-2"
              aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
            >
              {isPlaying ? <Pause className="h-6 w-6 fill-current md:h-5 md:w-5" /> : <Play className="h-6 w-6 fill-current md:h-5 md:w-5" />}
            </button>

            <button
              onClick={() => seekBy(-10)}
              className="rounded-full p-3 transition-all hover:bg-white/15 hover:-rotate-12 active:scale-95 md:p-2"
              aria-label="Voltar 10 segundos"
              title="Voltar 10s (J / ←)"
            >
              <RotateCcw className="h-6 w-6 md:h-5 md:w-5" />
            </button>
            <button
              onClick={() => seekBy(10)}
              className="rounded-full p-3 transition-all hover:bg-white/15 hover:rotate-12 active:scale-95 md:p-2"
              aria-label="Avançar 10 segundos"
              title="Avançar 10s (L / →)"
            >
              <RotateCw className="h-6 w-6 md:h-5 md:w-5" />
            </button>

            {/* Volume - hidden on smallest mobile, shown on larger mobile/tablet up */}
            <div className="group/vol hidden items-center sm:flex">
              <button
                onClick={toggleMute}
                className="rounded-full p-2 transition-all hover:bg-white/15 hover:scale-110 active:scale-95"
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

            {/* Time - Larger font on mobile, responsive margin */}
            <div className="ml-2 flex items-baseline gap-1 font-mono text-sm tabular-nums md:ml-3 md:gap-1.5 md:text-[13px]">
              <span className="font-semibold text-white">{formatTime(currentTime)}</span>
              <span className="text-white/30">/</span>
              <span className="text-white/50">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1 md:gap-1.5">
            <div className="flex items-center gap-1 px-1 mr-1 border-r border-white/10 md:gap-1.5 md:px-2 md:mr-2">
              {/* Raio-X Toggle */}
              <button
                onClick={toggleRaioX}
                className={cn(
                  "group relative flex items-center justify-center rounded-full p-3 transition-all duration-300 md:p-2",
                  isRaioXActive 
                    ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]" 
                    : "hover:bg-white/15 text-white/80 hover:text-white"
                )}
                aria-label="Ativar Raio-X"
                title="Raio-X (X)"
              >
                {isRaioXActive ? <Zap className="h-6 w-6 fill-current md:h-5 md:w-5" /> : <ZapOff className="h-6 w-6 md:h-5 md:w-5" />}
                {isRaioXActive && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 md:-top-1 md:-right-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                )}
              </button>

              {/* Screenshot */}
              <button
                onClick={takeScreenshot}
                className="flex items-center gap-1 rounded-full p-3 transition-colors hover:bg-white/15 text-white/80 hover:text-white md:p-2"
                aria-label="Capturar frame"
                title="Foto do frame (S)"
              >
                <Camera className="h-6 w-6 md:h-5 md:w-5" />
              </button>

              {/* WhatsApp Share — sales-first */}
              {canShareOnWhatsApp && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShareDialogOpen(true);
                  }}
                  className="flex items-center gap-1 rounded-full p-3 transition-colors hover:bg-[#25D366]/20 text-white/80 hover:text-[#25D366] md:p-2"
                  aria-label="Enviar vídeo pelo WhatsApp"
                  title="Enviar vídeo pelo WhatsApp"
                >
                  <MessageCircle className="h-6 w-6 md:h-5 md:w-5" />
                </button>
              )}
            </div>

            {/* Speed - Simplified on mobile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 rounded-full px-3 py-3 text-sm font-medium tabular-nums transition-colors hover:bg-white/15 md:px-2.5 md:py-2"
                  aria-label="Velocidade"
                  title="Velocidade (< / >)"
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
                    className={cn(playbackRate === rate && 'font-bold text-primary', "py-2.5")}
                  >
                    {rate === 1 ? 'Normal (1x)' : `${rate}x`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Quality Selector (HLS only) */}
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
                      {currentQuality === -1 ? 'Auto' : qualities.find(q => q.id === currentQuality)?.label}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuLabel>Qualidade</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setQuality(-1)}
                    className={cn(currentQuality === -1 && 'font-bold text-primary', "py-2.5")}
                  >
                    Auto
                  </DropdownMenuItem>
                  {qualities.map((q) => (
                    <DropdownMenuItem
                      key={q.id}
                      onClick={() => setQuality(q.id)}
                      className={cn(currentQuality === q.id && 'font-bold text-primary', "py-2.5")}
                    >
                      {q.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* PiP - Hidden on smallest mobile if space is tight */}
            <button
              onClick={togglePip}
              className="hidden rounded-full p-3 transition-colors hover:bg-white/15 sm:flex md:p-2"
              aria-label="Picture-in-Picture"
              title="Picture-in-Picture (P)"
            >
              <PictureInPicture2 className="h-6 w-6 md:h-5 md:w-5" />
            </button>

            {/* Fullscreen */}
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

      {/* WhatsApp share dialog (sales-first) */}
      {canShareOnWhatsApp && (
        <VideoShareWhatsAppDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          productName={productName || ''}
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
